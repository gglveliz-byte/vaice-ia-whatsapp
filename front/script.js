// Configuración
// El frontend se alojará en Netlify, y el backend en Render.
// Nota: La URL del backend en Render se actualizará cuando se despliegue.
const BACKEND_URL = 'https://vaice-ia-whatsapp.onrender.com';

// 1. "Ping" de calentamiento al cargar la página
// Esto asegura que el servidor en Render se despierte de su estado de "suspensión" (dormido)
// de los planes gratuitos, para que cuando el usuario envíe el formulario responda rápido.
document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando ping para despertar el backend...");
    // Hacemos una petición sin esperar realmente una respuesta para no bloquear el hilo.
    // Usamos catch para ignorar fallos silenciosamente.
    fetch(`${BACKEND_URL}/api/ping`, { mode: 'no-cors' })
        .then(() => console.log("Ping enviado al backend."))
        .catch(err => console.log("Ping falló o fue bloqueado por CORS, pero el backend debió despertarse."));
});

// Inicialización de intl-tel-input para el campo de teléfono
const inputTelefono = document.querySelector("#telefono");
const iti = window.intlTelInput(inputTelefono, {
  utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.4/build/js/utils.js",
  initialCountry: "auto",
  separateDialCode: true,
  geoIpLookup: function(callback) {
    fetch("https://ipapi.co/json")
      .then(function(res) { return res.json(); })
      .then(function(data) { callback(data.country_code); })
      .catch(function() { callback("us"); });
  }
});

// 2. Manejo del formulario de registro
const form = document.getElementById('registroForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const formMessage = document.getElementById('formMessage');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Obtener datos
    const nombre = document.getElementById('nombre').value;
    const telefonoCompleto = iti.getNumber(); // Esto ya incluye el código de país (ej: +593999123456)
    const password = document.getElementById('password').value;

    const data = {
        nombre,
        telefonoCompleto,
        password
    };

    // UI Loading state
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    submitBtn.disabled = true;
    formMessage.style.display = 'none';

    try {
        // Petición al backend
        const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            formMessage.style.color = '#4ade80';
            formMessage.textContent = '¡Registro completado! Ingresando a tu panel...';
            formMessage.style.display = 'block';

            // Auto-login
            const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefonoCompleto: data.telefonoCompleto, password: data.password })
            });

            if(loginRes.ok) {
                const loginData = await loginRes.json();
                localStorage.setItem('voice_token', loginData.token);
                localStorage.setItem('voice_user', JSON.stringify(loginData.user));
                
                setTimeout(() => {
                    if (loginData.user.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }, 1000);
            } else {
                window.location.href = 'login.html';
            }
        } else {
            // Error del servidor
            const errorData = await response.json();
            formMessage.style.color = '#ef4444'; // rojo
            formMessage.textContent = errorData.message || 'Error al registrar. Inténtalo de nuevo.';
            formMessage.style.display = 'block';
        }
    } catch (error) {
        // Error de red (Render podría seguir dormido si fue muy rápido)
        console.error("Error en el registro:", error);
        formMessage.style.color = '#ef4444'; // rojo
        formMessage.textContent = 'Error de conexión. Nuestro servidor podría estar arrancando, intenta nuevamente en unos segundos.';
        formMessage.style.display = 'block';
    } finally {
        // Reset UI state
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
});
