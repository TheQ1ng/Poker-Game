const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
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
        target: 'http://localhost:8086',
        changeOrigin: true,
        ws: true,
      }
    )
  );
};
