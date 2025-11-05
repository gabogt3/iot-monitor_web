const { BigQuery } = require('@google-cloud/bigquery');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const path = require('path');

const bigquery = new BigQuery();
const PROJECT_ID = process.env.PROJECT_ID || 'imonitor-miniups'; 
const DATASET_ID = 'miniups_raw';
const TABLE_ID = 'datos_genericos';

app.use((req, res, next) => {
  const iapHeader = 'x-goog-authenticated-user-email';
  const userEmail = 'gabogt4@gmail.com';//req.header(iapHeader);
  
  if (userEmail) {
    // Almacena el email para que el frontend lo pueda usar (opcional)
    req.user = { 
      email: userEmail.replace('accounts.google.com:', ''), // Limpiar el prefijo
      authenticatedBy: 'IAP'
    };
    console.log(`Usuario autenticado (por IAP): ${req.user.email}...`);
  } else {
    // Esto es solo para pruebas locales; en GCP, IAP garantiza este header.
    console.log('Advertencia: El header de IAP no está presente...');
    req.user = { email: 'usuario.local@example.com', authenticatedBy: 'Local' };
  }
  next();
});

// Sirve archivos estáticos (HTML, CSS, JS del frontend)
//app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));

// ====================================================================
// Endpoint para simular la consulta a BigQuery
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
// ====================================================================
// Endpoint para la consulta a BigQuery
// URL de la API: /api/datos-iot?start=1700000000000&end=1700000000000
// ====================================================================
app.get('/api/datos-iot', async (req, res) => {
    // 1. Obtener parámetros y realizar validación estricta
    const startTimeStr = req.query.start;
    const endTimeStr = req.query.end;

    // Validación de presencia
    if (!startTimeStr || !endTimeStr) {
        console.error('ERROR al Validación de presencia:', 'Faltan los parámetros de inicio (start) o fin (end).');
        return res.status(500).json({ error: 'Fallo interno', details: 'Fallo interno' });
    }

    // Validación de tipo de dato (Sanitización y Anti-SQL Injection)
    const startTimeMs = parseInt(startTimeStr, 10);
    const endTimeMs = parseInt(endTimeStr, 10);
    
    // a) Verificar que sean números enteros válidos
    if (isNaN(startTimeMs) || isNaN(endTimeMs)) {
        console.error('ERROR al Verificar que sean números enteros válidos:', 'Los parámetros de tiempo deben ser valores numéricos (tiempo UNIX).');
        return res.status(500).json({ error: 'Fallo interno', details: 'Fallo interno' });
    }
    
    // b) Verificar que sean valores positivos y razonables (p. ej., un rango de tiempo UNIX)
    if (startTimeMs <= 0 || endTimeMs <= 0 || startTimeMs >= endTimeMs) {
        console.error('ERROR al Verificar que sean valores positivos y razonables:', 'Rango de tiempo inválido o negativo.');
        return res.status(500).json({ error: 'Fallo interno', details: 'Fallo interno' });
    }

    // c) Validar la diferencia de tiempo para prevenir consultas demasiado grandes 
    const MAX_RANGE_MS = 30 * 24 * 3600 * 1000; // 30 días
    if (endTimeMs - startTimeMs > MAX_RANGE_MS) {
        console.error('ERROR al Validar la diferencia de tiempo para prevenir consultas demasiado grandes:', `El rango de tiempo excede el límite de ${MAX_RANGE_MS / (24 * 3600 * 1000)} días.`);
        return res.status(500).json({ error: 'Fallo interno', details: 'Fallo interno' });
    }


    // 2. Preparar valores seguros (Conversión a segundos para BigQuery)
    const startTimeSeconds = Math.floor(startTimeMs / 1000);
    const endTimeSeconds = Math.floor(endTimeMs / 1000);
    
    // 3. Consulta SQL parametrizada
    // Aunque BigQuery soporta parámetros, la conversión de TIMESTAMP_SECONDS requiere una sintaxis especial.
    // Para BigQuery, usaremos la conversión dentro de la SQL, garantizando que solo usamos números.
    const query = `
      SELECT
        timestamp,
        valor_float_1 AS humedad,
        valor_float_2 AS temperatura
      FROM
        \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
      WHERE
        timestamp BETWEEN TIMESTAMP_SECONDS(@startTime) AND TIMESTAMP_SECONDS(@endTime)
      ORDER BY
        timestamp
    `;
    
    // 4. Parámetros para BigQuery (Usando Query Parameterization)
    const options = {
        query: query,
        params: {
            // BigQuery infiere el tipo INT64 de Node.js Number para los segundos
            startTime: startTimeSeconds,
            endTime: endTimeSeconds,
        },
    };

    // 5. Ejecutar la consulta
    try {
        // Ejecutamos la consulta con los parámetros seguros
        const [rows] = await bigquery.query(options); 

        console.log(`Consulta exitosa. Filas encontradas: ${rows.length}`);
        
        // 6. Enviar los datos al frontend
        res.status(200).json(rows);
    } catch (error) {
        console.error('ERROR al ejecutar la consulta de BigQuery:', error);
        res.status(500).json({ error: 'Fallo interno', details: 'Fallo interno' });
    }
});

app.listen(port, () => {
  console.log(`Aplicación IoT escuchando en el puerto ${port}...`);
});
