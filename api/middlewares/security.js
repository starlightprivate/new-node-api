//Middleware for security
//Entry points, ip tampering, and so on
//it makes api return 403 error and sets `req.session.isBot` to true

import rangeCheck from 'range_check';
import config from './../../server-config';


//This is first pages of site, that real users usually visits
//TODO - verify that nothing is missing
const validEntryPoints = [
  '/',
  '/index.html',
  '/checkout.html',
  '/us_headlampoffer.html',
  '/customercare.html',
  '/partner.html',
  '/press.html',
  '/privacy.html',
  '/receipt.html',
  '/terms.html',
  '/tm3.html',
  '/us_batteryoffer.html'
];


//https://www.cloudflare.com/ips/
const cloudFlareIp4Range = [
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '104.16.0.0/12',
  '108.162.192.0/18',
  '131.0.72.0/22',
  '141.101.64.0/18',
  '162.158.0.0/15',
  '172.64.0.0/13',
  '173.245.48.0/20',
  '188.114.96.0/20',
  '190.93.240.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17'
];

const cloudFlareIp6Range = [
  '2400:cb00::/32',
  '2405:8100::/32',
  '2405:b500::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2c0f:f248::/32',
  '2a06:98c0::/29'
];


//this middleware have to be the first!!!
//https://starlightgroup.atlassian.net/projects/SG/issues/SG-35
exports.verifyThatSiteIsAccessedFromCloudflare = function (req, res, next) {
  let rIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
//https://github.com/keverw/range_check#check-if-ip-is-within-range
  let isOk = false;
// it helped me
// http://jodies.de/ipcalc?host=103.21.244.0&mask1=22&mask2=
  cloudFlareIp4Range.map(function (ipRange) {
    if(isOk) return;
    isOk = rangeCheck.inRange(rIp, ipRange);
  });
  if (isOk) {
    return next();
  }
//https://www.ultratools.com/tools/ipv6CIDRToRangeResult?ipAddress=2400%3Acb00%3A%3A%2F32
  cloudFlareIp6Range.map(function (ipRange) {
    if(isOk) return;
    isOk = rangeCheck.inRange(rIp, ipRange);
  });
  if (isOk) {
    return next();
  }
  return res
    .status(500)
    .end('NOT OK');
};

function getIp(req) {
//https://support.cloudflare.com/hc/en-us/articles/200170986-How-does-CloudFlare-handle-HTTP-Request-headers-
  if (config.ENV !== 'development' && req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }
//http://stackoverflow.com/a/10849772/1885921
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

exports.getIp = getIp;

//related issues for punishing middlewares:
//https://starlightgroup.atlassian.net/browse/SG-5
//https://starlightgroup.atlassian.net/browse/SG-8
//https://starlightgroup.atlassian.net/browse/SG-9

exports.punishForEnteringSiteFromBadLocation = function (req, res, next) {
  if (req.session) {
    if (validEntryPoints.indexOf(req.session.entryPoint) === -1) {
      if (config.ENV !== 'production') {
        res.set('X-PUNISHEDBY', 'BAD LOCATION');
      }
      req.session.isBot = true;
      return res.status(403).send('Invalid API Key');
    }
    return next();
  }
  return res.status(403).send('Invalid API Key');
};


exports.punishForChangingIP = function (req, res, next) {
  if (req.session) {
    let rIp = getIp(req);
    if (req.session.ip !== rIp) {
      if (config.ENV !== 'production') {
        res.set('X-PUNISHEDBY', 'BAD LOCATION');
      }
      req.session.isBot = true;
      return res.status(403).send('Invalid API Key');
    }
    return next();
  }
  return res.status(403).send('Invalid API Key');
};

exports.punishForChangingUserAgent = function (req, res, next) {
  if (req.session) {
    let ua = req.get('User-Agent');
    if (req.session.userAgent !== ua) {
      if (config.ENV !== 'production') {
        res.set('X-PUNISHEDBY', 'BAD UA');
      }
      req.session.isBot = true;
      return res.status(403).send('Invalid API Key');
    }
    return next();
  }
  return res.status(403).send('Invalid API Key');
};
