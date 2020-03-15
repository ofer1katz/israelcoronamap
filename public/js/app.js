/* eslint-disable no-unused-vars, no-undef */
let map, infoWindow, govData, data, threeDaysButton, allDaysButton, oneWeekButton, twoWeekButton, intervalId;
let currentPositionMarker = null;

const windowWidth = window.screen.availWidth;
let markersArray = [];
let previousCenters = [];

const init = () => {
  initTranslation();
  getButtonElements();
  getData();
};

const zoomToLocation = () => {
  // clear previous marker
  if (currentPositionMarker) {
    currentPositionMarker.setMap(null);
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
      toggleGPSIconColorOnClick();
      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      infoWindow.setPosition(pos);
      map.setCenter(pos);
      map.setZoom(13);

      currentPositionMarker = new google.maps.Marker({
        position: pos,
        animation: google.maps.Animation.DROP,
        map,
      });
      currentPositionMarker.setMap(map);
    }, () => {
      handleLocationError('לא אישרת מיקום');
    });
  } else {
    showOriginalIcon();
    // Browser doesn't support Geolocation
    handleLocationError('הדפדפן שלך לא תומך במיקום');
  }
};

const handleLocationError = () => {
  // TODO: Show a toast
  showOriginalIcon();
};

const showOriginalIcon = () => {
  document.getElementById('zoom-to-location-icon').src = 'assets/images/map-icons/gps.svg';
};

const toggleGPSIconColorOnClick = () => {
  document.getElementById('zoom-to-location-icon').src = 'assets/images/map-icons/gps-blue.svg';
  setTimeout(() => {
    document.getElementById('zoom-to-location-icon').src = 'assets/images/map-icons/gps.svg';
  }, 3000);
};

// This should remain with function syntax since it is called in the google maps callback
// eslint-disable-next-line func-style, no-unused-vars
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: windowWidth >= 500 ? { lat: 31.6, lng: 34.969073 } : { lat: 31.1, lng: 34.969073 },
    zoom: windowWidth >= 500 ? 8 : 7,
    gestureHandling: "greedy",
    streetViewControl: false,
    zoomControl: false
  });
  infoWindow = new google.maps.InfoWindow;
  map.addListener('mousedown', function () {
    if (infoWindow) {
      infoWindow.close();
      window.history.pushState("Corona map", "Corona map", "/");
    }
  });
  init();
}

const dist = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.lat() - p1.lat(),2) + Math.pow(p2.lng() - p1.lng(),2));
};

const getTimestamp = (stringTime) => {
  return new Date(stringTime).getTime();
};

const getQueryParam = (name) => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  return urlParams.get(name);
};

const clearMarkers = () => {
  for (let i = 0; i < markersArray.length; i++) {
    markersArray[i].setMap(null);
  }
  markersArray.length = 0;
};

const centerAndZoomToPoint = (point) => {
  const center = new google.maps.LatLng(point.lat, point.lon);
  map.panTo(center);
  map.setZoom(12);
};

const updateMap = () => {
  clearMarkers();

  let daysAgo = parseInt(getQueryParam('daysAgo'));
  if (isNaN(daysAgo)) {
    daysAgo = 10000;
  }
  const daysAgoDate = new Date();
  daysAgoDate.setDate(daysAgoDate.getDate() - daysAgo);
  const contentCelArr = [];

  const reqPointId = getQueryParam('id');
  for (let j = 0; j < govData.length; j++) {
    const currPoint = govData[j];
    if (getTimestamp(currPoint.t_end) < daysAgoDate) {
      continue;
    }
    const position = {
      lat: currPoint.lat,
      lng: currPoint.lon
    };
    let icon = '/assets/images/map-icons/allTime.svg';
    let zIndex = 1000;
    if (isYesterday(currPoint.pub_ts)) {
      icon = '/assets/images/map-icons/yesterday.svg';
      zIndex = 2000;
    } else if (isToday(currPoint.pub_ts)) {
      icon = '/assets/images/map-icons/today.svg';
      zIndex = 3000;
    }
    const marker = new google.maps.Marker({
      position,
      map,
      icon: {
        url: icon
      },
      zIndex
    });
    const direction = getDirection();

    const contentStringCal = `<div
                                id="infowindow" 
                                class="infowindow ${direction === 'ltr'? 'text-left': ''}"
                              >
                                <div class="info-label">${currPoint.label}</div>
                                <div class="info-description">${currPoint.text}</div>
                              </div>`;
    contentCelArr[j] = contentStringCal;
    if (currPoint.id === reqPointId) {
      updateCountdown(currPoint);
      key = pointKey(currPoint);
      intervalId = setInterval(() => {
        updateCountdown(currPoint);
      }, 1000);
      centerAndZoomToPoint(currPoint);
      infoWindow.setContent(contentStringCal);
      infoWindow.open(map, marker);
    }

    let id = currPoint.id;

    google.maps.event.addListener(marker, 'click', ((marker, i, id) => {
      return () => {
        clearInterval(intervalId);

        infoWindow.setContent(contentCelArr[i]);
        infoWindow.open(map, marker);
        let params = `/?id=${id}`
        const language =getQueryParam('language');
        if(language){
          params += `&language=${language}`;
        }
        window.history.pushState("Corona map", "Corona map", params);

        updateCountdown(currPoint);
        key = pointKey(currPoint);
        intervalId = setInterval(() => {
          updateCountdown(currPoint);
        }, 1000);

      };
    })(marker, j, id));

    markersArray.push(marker);
  }
};

const addFlightsMapPoint = () => {
  const position = {
    lat: 32.005528,
    lng: 34.885392
  };
  const icon = '/assets/images/map-icons/plane-map-icon.svg';
  const marker = new google.maps.Marker({
    position,
    map,
    icon: {
      url: icon
    },
    zIndex: 5000
  });
  const direction = getDirection();
  google.maps.event.addListener(marker, 'click', ((marker) => {
    return () => {
      const contentStringCal = `<div
        id="infowindow" 
        class="infowindow ${direction === 'ltr' ? 'text-left' : ''}"
      >
        <div class="info-label">טיסות שבהן שהו חולי קורונה</div>
        <div class="info-description"><a href="/flights">לפירוט הטיסות</a></div>
      </div>`;

      infoWindow.setContent(contentStringCal);
      infoWindow.open(map, marker);
      window.history.pushState("Corona map", "Corona map", "/");
    };
  })(marker));
};

const updateCountdown = currPoint => {
  const countdownDate = new Date(new Date(currPoint.last_end).getTime() + 12096e5).getTime();
  const now = new Date().getTime();
  const distance = countdownDate - now;

  const daysLeft = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const secondsLeft = Math.floor((distance % (1000 * 60)) / 1000);

  const key = pointKey(currPoint);
  const element = document.getElementById(`quarantine-${key}`);
  if (!element) return;

  element.innerHTML = "<b>זמן נותר לשוהים בבידוד: </b><br><span class=\"red-text\">" + daysLeft + " ימים " + hoursLeft + " שעות "
    + minutesLeft + " דקות " + secondsLeft + " שניות </span>";

  if (distance < 0) {
    element.innerHTML = "<b>זמן נותר לשוהים בבידוד:</b><br><span class=\"green-text\"> תמו 14 ימים ממועד החשיפה</span>";
    clearInterval(intervalId);
  }

};

const setDaysAgo = (daysAgo) => {
  window.history.pushState("Corona map", "Corona map", "/?daysAgo=" + daysAgo);
  updateMap();
};

const fixTime = (time) => {
  return ("0" + time).slice(-2);
};

const _textulize_visit_datetime = (point) => {
  let d_start = new Date(point.t_start);
  let d_end = new Date(point.t_end);
  let datestring = `${fixTime(d_start.getDate())}/${fixTime(d_start.getMonth() + 1)} ${i18n('betweenTheHours')} 
    ${fixTime(d_start.getHours())}:${fixTime(d_start.getMinutes())}-${fixTime(d_end.getHours())}:${fixTime(d_end.getMinutes())}`;
  return datestring;
};

const sortPoints = (points) => {
  points.sort((point1, point2) => {
    if (new Date(point1.t_end).getTime() > new Date(point2.t_end).getTime()) {
      return 1;
    } else {
      return -1;
    }
  });
  return points;
};

const filterPoints = points =>
  points.filter((point, index) => {
    if (index > 0 &&
      points[index - 1].t_start === point.t_start &&
      points[index - 1].t_end === point.t_end) {
      return false;
    }

    return true;
  });

const uniquifyArray = (array) => {
  const arraySet = new Set(array);
  const uniqueArray = Array.from(arraySet);
  return uniqueArray.filter(val => val);
};

const processData = () => {
  const pointsDict = new Object();
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const key = String([point.lat, point.lon]);
    if (!(key in pointsDict)) {
      pointsDict[key] = [point];
    } else {
      pointsDict[key].push(point);
    }
  }

  let result = [];
  for (let points of Object.values(pointsDict)) {
    sortPoints(points);
    const patNums = points.map(point => point.pat_num);
    const uniquePatNums = uniquifyArray(patNums);
    points = filterPoints(points);

    const firstPoint = points[0];
    if (firstPoint.text.length !== 0) {
      firstPoint.text += '<br><br>';
    } else {
      firstPoint.text += `<b>${i18n('patientNumber')}: </b>${uniquePatNums.join(', ')}<br><br>`;
    }
    if (points.length > 1) {
      firstPoint.text += `<b>${i18n('visitingTimes')}: </b><br>`;
      for (let i = 0; i < points.length; i++) {
        firstPoint.text += '<li>' + _textulize_visit_datetime(points[i]);
      }
      firstPoint.text += '<br><br>';
    } else {
      firstPoint.text += `<b>${i18n('visitingTime')}: </b>${_textulize_visit_datetime(firstPoint)}<br>`;
    }
    firstPoint.text += `<span class="pub_date"><b>${i18n('publishedDate')}: </b>${firstPoint.pub_date}</span><br>`;

    const lastPoint = points[points.length - 1];
    firstPoint.last_end = lastPoint.t_end;
    const key = pointKey(firstPoint);
    firstPoint.text += `<span class="quarantine-time" id="quarantine-${key}" class="quarantine_counter"></span><br>`;
    if (firstPoint.link) {
      firstPoint.text += `<br><a target="_blank" href="${firstPoint.link}">${i18n('linkToTheMinistryOfHealthPublication')}</a>`;
    }

    result.push(firstPoint);
  }
  return result;
};

const pointKey = point => `${point.lat}-${point.lon}`;

const isToday = (unixDate) => {
  const today = new Date();
  const date = new Date(unixDate * 1000);
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const isYesterday = (unixDate) => {
  const today = new Date();
  const date = new Date(unixDate * 1000);
  return date.getDate() === today.getDate() - 1 &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const getData = () => {
  const language = getLanguage();
  fetch(`/data/data${language}.json`)
    .then((response) => {
      return response.json();
    })
    .then((result) => {
      data = result;
      govData = processData(data);
      addFlightsMapPoint();
      updateMap();
    });
};

// eslint-disable-next-line no-unused-vars
const selectFilter = (filterType) => {
  threeDaysButton = document.getElementById('three-days-button');
  allDaysButton = document.getElementById('all-days-button');
  oneWeekButton = document.getElementById('one-weeks-button');
  twoWeekButton = document.getElementById('two-weeks-button');
  threeDaysButton.style.background = '#ffffff';
  allDaysButton.style.background = '#ffffff';
  oneWeekButton.style.background = '#ffffff';
  twoWeekButton.style.background = '#ffffff';
  switch (filterType) {
  case 'twoWeeks':
    setDaysAgo(14);
    twoWeekButton.style.background = '#FFCF4A';
    break;
  case 'week':
    setDaysAgo(7);
    oneWeekButton.style.background = '#FFCF4A';
    break;
  case '3Days':
    setDaysAgo(3);
    threeDaysButton.style.background = '#FFCF4A';
    break;
  case 'all':
    setDaysAgo(10000);
    allDaysButton.style.background = '#FFCF4A';
    break;
  }
};

const getButtonElements = () => {
  threeDaysButton = document.getElementById('three-days-button');
  allDaysButton = document.getElementById('all-days-button');
  oneWeekButton = document.getElementById('one-weeks-button');
  twoWeekButton = document.getElementById('two-weeks-button');
};

const changeLanguage = () => {
  const value = document.getElementById('language-select').value;
  let params = `/?language=${value}`;
  const id = parseInt(getQueryParam('id'));
  if(id){
    params += `&id=${id}`;
  }
  window.history.pushState("Corona map", "Corona map", params);
  setLanguage(value);
  setTranslation(value);
  setTranslationInHTML();
  getData();
};
