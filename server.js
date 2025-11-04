// server.js
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// ====================================================================
// PASO 1: Middleware para acceder a la identidad de IAP
// IAP inyecta la identidad del usuario a través de un header específico.
// No es un login tradicional, ¡IAP lo hace por nosotros!
// ====================================================================
app.use((req, res, next) => {
  const iapHeader = 'x-goog-authenticated-user-email';
  const userEmail = 'gabogt4@gmail.com';//req.header(iapHeader);
  
  if (userEmail) {
    // Almacena el email para que el frontend lo pueda usar (opcional)
    req.user = { 
      email: userEmail.replace('accounts.google.com:', ''), // Limpiar el prefijo
      authenticatedBy: 'IAP'
    };
    console.log(`Usuario autenticado (por IAP): ${req.user.email}`);
  } else {
    // Esto es solo para pruebas locales; en GCP, IAP garantiza este header.
    console.log('Advertencia: El header de IAP no está presente.');
    req.user = { email: 'usuario.local@example.com', authenticatedBy: 'Local' };
  }
  next();
});

// Sirve archivos estáticos (HTML, CSS, JS del frontend)
app.use(express.static('public'));

// ====================================================================
// PASO 2: Endpoint para simular la consulta a BigQuery
// Esta es la función que debe obtener los datos reales (simulados aquí)
// ====================================================================
app.get('/api/iot-data', (req, res) => {
  // En un entorno real, aquí se consultaría BigQuery:
  // const { BigQuery } = require('@google-cloud/bigquery');
  // const bigquery = new BigQuery();
  // const query = 'SELECT timestamp, temperature, humidity FROM my_iot_data ORDER BY timestamp DESC LIMIT 100';
  // const [rows] = await bigquery.query({ query });
  
  // Datos simulados:
  const now = Date.now();
  const data = [];
  for (let i = 0; i < 50; i++) {
    const time = now - (i * 3600000); // Espaciado cada hora
    data.push({
      time: new Date(time).toISOString(),
      temperature: 20 + Math.random() * 5 + Math.sin(i / 5) * 2,
      humidity: 50 + Math.random() * 10 - Math.cos(i / 10) * 5
    });
  }

  res.json({
    user: req.user.email, // Devolvemos la identidad obtenida por IAP
    data: data.reverse()
  });
});

app.listen(port, () => {
  console.log(`Aplicación IoT escuchando en el puerto ${port}`);
});
