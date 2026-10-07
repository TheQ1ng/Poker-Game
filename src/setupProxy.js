const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const backendPort = process.env.REACT_APP_BACKEND_PORT || "1999";
  app.use(
    createProxyMiddleware(
      [
        '/root',
        '/json',
        '/rooms',
        '/register',
        '/currentroom',
        '/createroom',
        '/joinroom',
        '/updateprofile',
        '/profile',
      ],
      {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        ws: true,
      }
    )
  );
};
