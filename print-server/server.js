const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3009;

// Helper to print PDF on different OS
function printFile(filePath) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    let command = '';

    if (isWindows) {
      // Windows command to print PDF (using powershell or PDFtoPrinter if available)
      // Standard PowerShell print verb:
      command = `powershell -Command "Start-Process -FilePath '${filePath}' -Verb Print -PassThru | % { $_.WaitForExit(); $_.Close() }"`;
    } else {
      // Linux/macOS command: lp
      command = `lp "${filePath}"`;
    }

    console.log(`Ejecutando comando de impresión: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error al imprimir:', error);
        return reject(error);
      }
      console.log('Impresión enviada correctamente:', stdout);
      resolve(stdout);
    });
  });
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET /status
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'running', platform: process.platform }));
    return;
  }

  // POST /print
  if (req.method === 'POST' && req.url === '/print') {
    // Collect multipart/form-data or binary raw body
    let body = [];
    req.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', async () => {
      const buffer = Buffer.concat(body);

      // Save PDF buffer to a temp file
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      const tempFilePath = path.join(tempDir, `print_${Date.now()}.pdf`);
      
      try {
        // Parse simple multipart boundary to extract raw PDF
        const boundary = req.headers['content-type'].split('boundary=')[1];
        let fileBuffer = buffer;

        if (boundary) {
          // Extract the PDF buffer from multipart boundary
          const boundaryStr = '--' + boundary;
          const parts = buffer.toString('binary').split(boundaryStr);
          const filePart = parts.find(part => part.includes('application/pdf') || part.includes('filename='));
          
          if (filePart) {
            const headerEndIndex = filePart.indexOf('\r\n\r\n') + 4;
            const fileDataBinary = filePart.slice(headerEndIndex, filePart.lastIndexOf('\r\n'));
            fileBuffer = Buffer.from(fileDataBinary, 'binary');
          }
        }

        fs.writeFileSync(tempFilePath, fileBuffer);
        console.log(`Archivo PDF guardado temporalmente en: ${tempFilePath}`);

        // Print the file
        await printFile(tempFilePath);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Impresión enviada correctamente' }));

        // Delete temp file after a short delay
        setTimeout(() => {
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (e) {
            console.error('Error al eliminar archivo temporal:', e);
          }
        }, 10000);

      } catch (err) {
        console.error('Error procesando impresión:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Not found
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Servidor de Impresión Local de PosEngine iniciado`);
  console.log(`Puerto: ${PORT}`);
  console.log(`Plataforma detectada: ${process.platform}`);
  console.log(`=================================================`);
});
