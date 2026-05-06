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

// 🚐 RUTA INTELIGENTE
let indiceRuta = 0
let rutaLinea = null
let ultimaRecalculo = 0
let ultimaPosicionRuta = null

// 🔔 AVISOS
let avisados = {}

// 🚐 ICONO
const iconoColectivo = L.icon({
  iconUrl: "colectivo.png",
  iconSize: [60, 60],
  iconAnchor: [28, 28]
})

// 🔄 PANTALLAS
function mostrar(p){

  [
    "pantallaModo",
    "pantallaAlumnos",
    "pantallaRuta",
    "pantallaGPS",
    "pantallaPadres",
    "pantallaMapaSeleccion",
    "pantallaLoginPadres"
  ].forEach(id=>{
    let el = document.getElementById(id)
    if(el) el.style.display="none"
  })

  let pantalla = document.getElementById(p)
  if(pantalla) pantalla.style.display="block"

  setTimeout(()=>{
    if(p==="pantallaGPS") iniciarGPS()
    if(p==="pantallaRuta") mostrarRuta()
  },200)
}

// 🚐 MODO
function modoChofer(){
  mostrar("pantallaAlumnos")
}

// 🔙
function volverModo(){
  location.reload()
}

// 🔥 CARGAR ALUMNOS
db.ref("alumnos").on("value", (snap)=>{
  alumnos = snap.val() || []
  alumnosDibujados = false
})

// 📋 LISTA RUTA
function mostrarRuta(){

  let lista = document.getElementById("listaRuta")
  if(!lista) return

  lista.innerHTML=""

  alumnos.forEach((a,i)=>{
    let li = document.createElement("li")
    li.innerHTML = `${i+1}. ${a.nombre}`
    lista.appendChild(li)
  })
}

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

    // 🚐 marcador
    if(!markerChofer){
      markerChofer = L.marker([lat, lon], {icon: iconoColectivo}).addTo(mapChofer)
    }else{
      markerChofer.setLatLng([lat, lon])
    }

    // 📍 precisión
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

      // evitar recalcular sin moverse
      if(ultimaPosicionRuta){
        let mov = distanciaMetros(ultimaUbicacion, ultimaPosicionRuta)
        if(mov < 10) return
      }

      ultimaPosicionRuta = {...ultimaUbicacion}

      let destino = alumnos[indiceRuta]

      if(destino){

        let dist = distanciaMetros(ultimaUbicacion, destino)

        // 🔔 aviso padres
        if(dist < 500 && !avisados[destino.dni]){
          avisados[destino.dni] = true

          db.ref("avisos/" + destino.dni).set({
            mensaje: "🚐 El transporte está llegando",
            tiempo: Date.now()
          })
        }

        // 🚐 llegó
        if(dist < 40){
          indiceRuta++

          if(rutaLinea){
            mapChofer.removeLayer(rutaLinea)
          }

          return
        }

        // 🔄 recalcular ruta
        let ahora = Date.now()
        if(ahora - ultimaRecalculo > 5000){
          ultimaRecalculo = ahora
          calcularRutaActual()
        }
      }
    }

  },
  (err)=>console.log("GPS error:", err),
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

// 🚐 INICIAR RUTA
function comenzarRuta(){

  if(alumnos.length === 0){
    alert("No hay alumnos")
    return
  }

  indiceRuta = 0
  avisados = {}
  window.rutaActiva = true

  calcularRutaActual()
}

// 🧠 CALCULAR RUTA
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

  try{
    let url = `https://router.project-osrm.org/route/v1/driving/${coords.join(";")}?overview=full&geometries=geojson`

    let res = await fetch(url)
    let data = await res.json()

    let rutaCoords = data.routes[0].geometry.coordinates
    let latlngs = rutaCoords.map(c => [c[1], c[0]])

    if(rutaLinea){
      mapChofer.removeLayer(rutaLinea)
    }

    rutaLinea = L.polyline(latlngs, {weight:5}).addTo(mapChofer)

  }catch(e){
    console.log("Error ruta:", e)
  }
}
