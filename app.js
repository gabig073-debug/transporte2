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
let alumnoPadre = null

let watchID = null
let ultimaUbicacion = null

let mapChofer = null
let markerChofer = null
let circleChofer = null

let mapPadres = null
let markerPadres = null
let circlePadres = null
let markerAlumnoPadre = null
let rutaPadres = null

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
    if(p==="pantallaPadres") iniciarPadres()
  },200)
}

// 🚐 MODO
function modoChofer(){
  mostrar("pantallaAlumnos")
}

// 🔐 LOGIN PADRES
function ingresarPadre(){
  let dni = document.getElementById("dniPadre").value

  if(!dni){
    alert("Ingresá DNI")
    return
  }

  alumnoPadre = alumnos.find(a => a.dni == dni)

  if(!alumnoPadre){
    alert("DNI no encontrado")
    return
  }

  mostrar("pantallaPadres")
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

    if(window.rutaActiva){

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

// 👨‍👩‍👧 MODO PADRES COMPLETO
function iniciarPadres(){

  if(!alumnoPadre){
    mostrar("pantallaLoginPadres")
    return
  }

  if(mapPadres){
    mapPadres.remove()
    mapPadres = null
    markerPadres = null
    circlePadres = null
    markerAlumnoPadre = null
    rutaPadres = null
  }

  mapPadres = L.map('mapaPadres').setView([0,0], 16)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
  .addTo(mapPadres)

  setTimeout(()=>mapPadres.invalidateSize(),300)

  db.ref("ubicacion").on("value",(snap)=>{

    let data = snap.val()
    if(!data) return

    let lat = data.lat
    let lon = data.lon
    let accuracy = data.accuracy || 20

    if(!markerPadres){
      markerPadres = L.marker([lat, lon], {icon: iconoColectivo}).addTo(mapPadres)
    }else{
      markerPadres.setLatLng([lat, lon])
    }

    if(!circlePadres){
      circlePadres = L.circle([lat, lon], {radius: accuracy}).addTo(mapPadres)
    }else{
      circlePadres.setLatLng([lat, lon])
      circlePadres.setRadius(accuracy)
    }

    if(alumnoPadre.lat && alumnoPadre.lon){

      if(!markerAlumnoPadre){
        markerAlumnoPadre = L.circle([alumnoPadre.lat, alumnoPadre.lon], {
          radius: 30,
          color: "red",
          fillColor: "red",
          fillOpacity: 0.6
        }).addTo(mapPadres)
      }

      let ahora = Date.now()

      if(!window.ultimaRutaPadres || (ahora - window.ultimaRutaPadres > 7000)){
        window.ultimaRutaPadres = ahora

        let coords = [
          `${lon},${lat}`,
          `${alumnoPadre.lon},${alumnoPadre.lat}`
        ]

        fetch(`https://router.project-osrm.org/route/v1/driving/${coords.join(";")}?overview=full&geometries=geojson`)
        .then(res=>res.json())
        .then(data=>{

          if(!data.routes) return

          let rutaCoords = data.routes[0].geometry.coordinates
          let latlngs = rutaCoords.map(c => [c[1], c[0]])

          if(rutaPadres){
            mapPadres.removeLayer(rutaPadres)
          }

          rutaPadres = L.polyline(latlngs, {weight:5}).addTo(mapPadres)
        })
      }
    }

    mapPadres.setView([lat, lon], 16)

  })

  // 🔔 AVISO PADRES
  db.ref("avisos/" + alumnoPadre.dni).on("value",(snap)=>{

    let aviso = snap.val()
    if(!aviso) return

    if(window.ultimoAviso === aviso.tiempo) return

    window.ultimoAviso = aviso.tiempo

    alert(aviso.mensaje)
  })
}
