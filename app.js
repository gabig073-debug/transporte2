// 🔥 TOKEN
const TOKEN = "trans_oran_2026"

// 🔥 FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "transalumnos-7841c.firebaseapp.com",
  databaseURL: "https://transalumnos-7841c-default-rtdb.firebaseio.com",
  projectId: "transalumnos-7841c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 📍 VARIABLES
let alumnos = []
let watchID = null
let ultimaUbicacion = null

let mapChofer = null
let markerChofer = null
let circleChofer = null

let capasAlumnos = []
let alumnosDibujados = false

// 🔥 GPS PRO
let indiceRuta = 0
let rutaLinea = null
let ultimaRecalculo = 0

// 🔔 CONTROL AVISOS
let avisados = {} // evita repetir aviso

// 🚐 ICONO
const iconoColectivo = L.icon({
  iconUrl: "colectivo.png",
  iconSize: [60, 60],
  iconAnchor: [28, 28]
})

// 🔥 CARGAR ALUMNOS
db.ref("alumnos").on("value", (snap)=>{
  alumnos = snap.val() || []
  alumnosDibujados = false
})

// 🔴 DIBUJAR ALUMNOS
function dibujarAlumnosEnMapa(){

  if(!mapChofer) return

  capasAlumnos.forEach(c => mapChofer.removeLayer(c))
  capasAlumnos = []

  alumnos.forEach(a=>{
    if(a.lat && a.lon){

      let circulo = L.circle([a.lat, a.lon], {
        radius: 20,
        color: "red",
        fillColor: "red",
        fillOpacity: 0.5
      }).addTo(mapChofer)

      capasAlumnos.push(circulo)
    }
  })
}

// 📡 GPS CHOFER
function iniciarGPS(){

  if(watchID !== null){
    navigator.geolocation.clearWatch(watchID)
    watchID = null
  }

  if(!mapChofer){
    mapChofer = L.map('mapa').setView([0,0], 16)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    .addTo(mapChofer)

    setTimeout(()=>mapChofer.invalidateSize(),300)
  }

  if(!alumnosDibujados){
    dibujarAlumnosEnMapa()
    alumnosDibujados = true
  }

  watchID = navigator.geolocation.watchPosition((pos)=>{

    let lat = pos.coords.latitude
    let lon = pos.coords.longitude
    let accuracy = pos.coords.accuracy

    ultimaUbicacion = {lat, lon}

    db.ref("ubicacion").set({
      lat,
      lon,
      accuracy,
      time: Date.now(),
      token: TOKEN
    })

    if(!markerChofer){
      markerChofer = L.marker([lat, lon], {icon: iconoColectivo}).addTo(mapChofer)
    }else{
      markerChofer.setLatLng([lat, lon])
    }

    if(!circleChofer){
      circleChofer = L.circle([lat, lon], {radius: accuracy}).addTo(mapChofer)
    }else{
      circleChofer.setLatLng([lat, lon])
      circleChofer.setRadius(accuracy)
    }

    if(!window.rutaActiva){
      mapChofer.setView([lat, lon], 17)
    }

    // 🔥 GPS INTELIGENTE
    if(window.rutaActiva){

      let destino = alumnos[indiceRuta]

      if(destino){

        let dist = distanciaMetros(ultimaUbicacion, destino)

        // 🔔 AVISO A PADRES (500m)
        if(dist < 500 && !avisados[destino.dni]){
          avisados[destino.dni] = true

          db.ref("avisos/" + destino.dni).set({
            mensaje: "🚐 El transporte está llegando",
            tiempo: Date.now()
          })
        }

        // 🚐 LLEGÓ AL PUNTO
        if(dist < 40){
          indiceRuta++

          if(rutaLinea){
            mapChofer.removeLayer(rutaLinea)
          }

          return
        }

        // 🔄 RECALCULAR RUTA (cada 5s)
        let ahora = Date.now()
        if(ahora - ultimaRecalculo > 5000){
          ultimaRecalculo = ahora
          calcularRutaActual()
        }
      }
    }

  },
  (err)=>console.log(err),
  {
    enableHighAccuracy:true,
    timeout:15000,
    maximumAge:0
  })
}

// 📏 DISTANCIA
function distanciaMetros(a, b){
  let R = 6371000
  let dLat = (b.lat - a.lat) * Math.PI/180
  let dLon = (b.lon - a.lon) * Math.PI/180

  let lat1 = a.lat * Math.PI/180
  let lat2 = b.lat * Math.PI/180

  let x = dLon * Math.cos((lat1+lat2)/2)
  let d = Math.sqrt(dLat*dLat + x*x) * R

  return d
}

// 🚐 COMENZAR RUTA
function comenzarRuta(){

  if(alumnos.length === 0){
    alert("No hay alumnos")
    return
  }

  indiceRuta = 0
  avisados = {} // reset avisos
  window.rutaActiva = true

  calcularRutaActual()
}

// 🧠 CALCULAR RUTA DINÁMICA
async function calcularRutaActual(){

  if(!ultimaUbicacion) return

  if(indiceRuta >= alumnos.length){
    alert("Ruta terminada ✅")
    window.rutaActiva = false

    if(rutaLinea){
      mapChofer.removeLayer(rutaLinea)
    }

    return
  }

  let destino = alumnos[indiceRuta]

  let coords = [
    `${ultimaUbicacion.lon},${ultimaUbicacion.lat}`,
    `${destino.lon},${destino.lat}`
  ]

  let url = `https://router.project-osrm.org/route/v1/driving/${coords.join(";")}?overview=full&geometries=geojson`

  let res = await fetch(url)
  let data = await res.json()

  let rutaCoords = data.routes[0].geometry.coordinates
  let latlngs = rutaCoords.map(c => [c[1], c[0]])

  if(rutaLinea){
    mapChofer.removeLayer(rutaLinea)
  }

  rutaLinea = L.polyline(latlngs, {weight:5}).addTo(mapChofer)
}
