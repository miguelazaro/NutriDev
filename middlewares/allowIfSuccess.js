module.exports = function allowIfSuccess(req, res, next) {
  if (req.query.ok === '1' || req.query.ok === '0') return next();s
  if (req.session?.usuario) return next();

};
