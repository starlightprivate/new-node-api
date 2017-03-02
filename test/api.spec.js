'use strict';
/* global it, describe, process */

import supertest from 'supertest';
import app from '../app.js';
import util from 'util';

require('should');

const sessionIdCookieRegex = /^PHPSESSID\=([^\;]+)\; Path=\/\; HttpOnly/;
const csrfTokenCookieRegex = /^XSRF\-TOKEN\=([^\;]+)\; Path=\//;

function extractCookie(res, rgx) {
  let
    cookies = res.headers['set-cookie'],
    val,
    matched = false;
  cookies.map(function (c) {
    if (!matched) {
      let results = rgx.exec(c);
      if (results) {
        val = results[1];
        matched = true;
      }
    }
  });
  if (matched) {
    return val;
  }
  return false;
}

console.log('NodeJS version being used - %s for %s', process.version, process.arch);

describe('web application', function () {
// eslint-disable-next-line
  this.timeout(10000); //not everybody have good internet connection, including codeship

  let
//being used in all requests
    sessionId,
    csrfToken,
//being used in requests emulating typical bot behaviour
    taintedSessionId,
    taintedCsrfToken;

  it('has anything on / but we need to start session properly to run tests', function (done) {
    supertest(app)
      .get('/')
      .expect('X-Powered-By', 'TacticalMastery')
      .end(function (error, res) {
        if (error) {
          return done(error);
        }
        // console.log('/api/v2/ping cookies ',res.headers['set-cookie']);
        let sId = extractCookie(res, sessionIdCookieRegex);
        if (sId === false) {
          return done(new Error('PHPSESSID not set!'));
        }
        let csrf = extractCookie(res, csrfTokenCookieRegex);
        if (csrf === false) {
          return done(new Error('XSRF-TOKEN not set!'));
        }
        sessionId = sId;
        csrfToken = csrf;
        done();
      });
  });

  it('has 200 and pong on /api/v2/ping', function (done) {
    supertest(app)
      .get('/api/v2/ping')
      .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
      .expect('X-Powered-By', 'TacticalMastery')
      .expect(200, {msg: 'PONG'})
      .end(function (error, res) {
        if (error) {
          return done(error);
        }
        // console.log('/api/v2/ping cookies ',res.headers['set-cookie']);
        let sId = extractCookie(res, sessionIdCookieRegex);
        if (sId !== false) {
          return done(new Error('PHPSESSID is reset! Bad session behaviour'));
        }
        let csrf = extractCookie(res, csrfTokenCookieRegex);
        if (csrf === false) {
          return done(new Error('XSRF-TOKEN not set!'));
        }
        csrfToken = csrf;
        done();
      });
  });
  it('has 403 for /api/v2/pong with wrong entry point', function (done) {
    supertest(app)
      .get('/api/v2/ping')
      //      .set('Cookie', [util.format('PHPSESSID=%s', sessionId)]) - no session id - aka first visit!!!
      .expect('X-Powered-By', 'TacticalMastery')
      .expect('X-PUNISHEDBY', 'BAD LOCATION')
      .expect(403, 'Invalid API Key')
      .end(function (error, res) {
        if (error) {
          return done(error);
        }
        // console.log('/api/v2/ping cookies ',res.headers['set-cookie']);
        let sId = extractCookie(res, sessionIdCookieRegex);
        if (sId === false) {
          return done(new Error('PHPSESSID not set!'));
        }
        let csrf = extractCookie(res, csrfTokenCookieRegex);
        if (csrf === false) {
          return done(new Error('XSRF-TOKEN not set!'));
        }
        taintedSessionId = sId;
        taintedCsrfToken = csrf;
        done();
      });
  });


  describe('testing sessions', function () {
// https://starlightgroup.atlassian.net/browse/SG-5
    it('sets proper data for /api/v2/testSession WITH session token provided', function (done) {
      supertest(app)
        .get('/api/v2/testSession')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .expect('X-Powered-By', 'TacticalMastery')
        .expect(200)
        .end(function (error, res) {
          if (error) {
            return done(error);
          }
          // console.log('/api/v2/testSession with session token cookies ',res.headers['set-cookie']);

          res.body.ip.should.exist;
          res.body.entryPoint.should.be.equal('/');
          res.body.userAgent.should.match(/^node-superagent/);
          res.body.isBot.should.be.false;
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          csrfToken = csrf;

          let sId = extractCookie(res, sessionIdCookieRegex);
          if (sId === false) {
            return done();
          }
          return done(new Error('PHPSESSID is reset! Bad session behaviour'));
        });
    });

    it('sets proper data for /api/v2/testSession WITHOUT session token provided', function (done) {
      supertest(app)
        .get('/api/v2/testSession')
        .expect('X-Powered-By', 'TacticalMastery')
        .expect('X-PUNISHEDBY', 'BAD LOCATION')
        .expect(403, 'Invalid API Key', done);
    });
  });

  it('has 200 and NY on /api/v2/state/00544', function (done) {
    supertest(app)
      .get('/api/v2/state/00544')
      .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
      .expect(200)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        res.body.should.exist;
        res.body.data.should.exist;
        res.body.data.state.should.exist;
        res.body.data.state.should.be.equal('NY');
        done();
      });
  });

  it('has 200 and Marion city on /api/v2/state/62959', function (done) {
    supertest(app)
      .get('/api/v2/state/62959')
      .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
      .expect(200)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        res.body.should.exist;
        res.body.data.should.exist;
        res.body.data.city.should.exist;
        res.body.data.city.should.be.equal('Marion');
        done();
      });
  });

  it('has 200 and Beverly Hills on /api/v2/state/90210', function (done) {
    supertest(app)
      .get('/api/v2/state/90210')
      .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
      .expect(200)
      .end(function (err, res) {
        if (err) {
          return done(err);
        }
        res.body.should.exist;
        res.body.data.should.exist;
        res.body.data.city.should.exist;
        res.body.data.city.should.be.equal('Beverly Hills');
        done();
      });
  });

  describe('/api/v2/add-contact', function () {
    let
      acCsrfToken,
      acSessionId;

    it('has anything on/ but we need to start session properly to run tests', function (done) {
      supertest(app)
        .get('/')
        .expect('X-Powered-By', 'TacticalMastery')
        .end(function (error, res) {
          if (error) {
            return done(error);
          }
          // console.log('/api/v2/ping cookies ',res.headers['set-cookie']);
          let sId = extractCookie(res, sessionIdCookieRegex);
          if (sId === false) {
            return done(new Error('PHPSESSID not set!'));
          }
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          acSessionId = sId;
          acCsrfToken = csrf;

          done();
        });
    });


    it('has 200 on POST /api/v2/add-contact', function (done) {
      supertest(app)
        .post('/api/v2/add-contact')
        .set('Cookie', [util.format('PHPSESSID=%s', acSessionId)])
        .send({
          FirstName: 'test_FirstName',
          LastName: 'test_LastName',
          Email: 'test@email.com',
          Phone: '222-222-4444',
          _csrf: acCsrfToken
        })
        .expect(200, function (error, res) {
          if (error) {
            return done(error);
          }
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          done();
        });
    });
    it('has 403 on POST /api/v2/add-contact with missing CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/add-contact')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          FirstName: 'test_FirstName',
          LastName: 'test_LastName',
          Email: 'test@email.com',
          Phone: '222-222-4444',
          // _csrf: csrfToken
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/add-contact with bad CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/add-contact')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          FirstName: 'test_FirstName',
          LastName: 'test_LastName',
          Email: 'test@email.com',
          Phone: '222-222-4444',
          _csrf: 'Во имя Отца, и Сына, и Святаго духа, аминь!'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/add-contact without session', function (done) {
      supertest(app)
        .post('/api/v2/add-contact')
        .send({
          FirstName: 'test_FirstName',
          LastName: 'test_LastName',
          Email: 'test@email.com',
          Phone: '222-222-4444'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/add-contact with bad entry point', function (done) {
      supertest(app)
        .post('/api/v2/add-contact')
        .set('Cookie', [util.format('PHPSESSID=%s', taintedSessionId)])
        .expect('X-PUNISHEDBY', 'BAD LOCATION')
        .send({
          FirstName: 'test_FirstName',
          LastName: 'test_LastName',
          Email: 'test@email.com',
          Phone: '222-222-4444',
          _csrf: taintedCsrfToken
        })
        .expect(403, 'Invalid API Key', done);
    });
  });

  describe('/api/v2/update-contact', function () {
    let ucSessionId,
      ucCsrfToken;

    it('has anything on / but we need to start session properly to run tests', function (done) {
      supertest(app)
        .get('/')
        .expect('X-Powered-By', 'TacticalMastery')
        .end(function (error, res) {
          if (error) {
            return done(error);
          }
          // console.log('/api/v2/ping cookies ',res.headers['set-cookie']);
          let sId = extractCookie(res, sessionIdCookieRegex);
          if (sId === false) {
            return done(new Error('PHPSESSID not set!'));
          }
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          ucSessionId = sId;
          ucCsrfToken = csrf;
          done();
        });
    });
    it('has 200 on POST /api/v2/update-contact', function (done) {
      supertest(app)
        .post('/api/v2/update-contact')
        .set('Cookie', [util.format('PHPSESSID=%s', ucSessionId)])
        .send({
          firstName: 'test_FirstName_updated',
          lastName: 'test_LastName_updated',
          emailAddress: 'test@email.com',
          phoneNumber: '111-222-3333',
          _csrf: ucCsrfToken
        })
        .expect(200, function (error, res) {
          if (error) {
            return done(error);
          }
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          ucCsrfToken = csrf;
          done();
        });
    });
    it('has 403 on POST /api/v2/update-contact with missing CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/update-contact')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          firstName: 'test_FirstName_updated',
          lastName: 'test_LastName_updated',
          emailAddress: 'test@email.com',
          phoneNumber: '111-222-3333'
          // _csrf: csrfToken
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/update-contact with bad CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/update-contact')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          firstName: 'test_FirstName_updated',
          lastName: 'test_LastName_updated',
          emailAddress: 'test@email.com',
          phoneNumber: '111-222-3333',
          _csrf: 'Во имя Отца, и Сына, и Святаго духа, аминь!'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/update-contact without session data', function (done) {
      supertest(app)
        .post('/api/v2/update-contact')
        .send({
          firstName: 'test_FirstName_updated',
          lastName: 'test_LastName_updated',
          emailAddress: 'test@email.com',
          phoneNumber: '111-222-3333'
        })
        .expect(403, 'Invalid API Key', done);
    });
  });
//TODO for every endpoint
  it('prevents session tampering by changing IP'); //imho realy hard to test by `supertest`....
  it('prevents session tampering by changing user agent');
  it('protects from bot who entered the site using wrong entry point');


//https://starlightgroup.atlassian.net/browse/SG-80
// Only check API call
  describe('/api/v2/get-lead', function () {
    it('has 200 on GET on /api/v2/get-lead/:id', function (done) {
      supertest(app)
        .get('/api/v2/get-lead/25B18557B3')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .expect(200, function (error, res) {
          if (error) {
            return done(error);
          }
          if (res.body.success) {
            res.body.data.should.exist;
          } else {
            res.body.error.should.exist;
          }
          return done();
        });
    });
  });

  describe('/api/v2/get-trans', function () {
    it('has 200 on GET /api/v2/get-trans/:id', function (done) {
      supertest(app)
        .get('/api/v2/get-trans/25B18557B3')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .expect(200, function (error, res) {
          if (error) {
            return done(error);
          }
          if (res.body.success) {
            res.body.data.should.exist;
          } else {
            res.body.error.should.exist;
          }
          return done();
        });
    });
  });

  describe('/api/v2/create-lead', function () {
    it('has 403 on POST /api/v2/create-lead with missing CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/create-lead')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          someSaneData: 'to be entered here'
          // _csrf: csrfToken
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/create-lead with bad CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/create-lead')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          someSaneData: 'to be entered here',
          _csrf: 'Во имя Отца, и Сына, и Святаго духа, аминь!'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/create-lead with wrong entryPoint', function (done) {
      supertest(app)
        .post('/api/v2/create-lead')
        .set('Cookie', [util.format('PHPSESSID=%s', taintedSessionId)])
        .expect('X-PUNISHEDBY', 'BAD LOCATION')
        .send({
          someSaneData: 'to be entered here',
          _csrf: taintedCsrfToken
        })
        .expect(403, 'Invalid API Key', done);
    });

    it('has 200 on POST /api/v2/create-lead', function (done) {
      supertest(app)
        .post('/api/v2/create-lead')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          firstName: 'test',
          phoneNumber: '111-111-1111',
          emailAddress: 'test@test.com',
          _csrf: csrfToken
        })
        .expect(200, function (error, res) {
          if (error) {
            return done(error);
          }
          if (res.body.success) {
            res.body.orderId.should.exist;
          } else {
            res.body.error.should.exist;
          }
          return done();
        });
    });

  });
  describe('/api/v2/create-order', function () {
    let createOrderCSRFToken;

    it('has anything on / but we need to start session properly to run tests', function (done) {
      supertest(app)
        .get('/')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .expect('X-Powered-By', 'TacticalMastery')
        .end(function (error, res) {
          if (error) {
            return done(error);
          }
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          createOrderCSRFToken = csrf;
          done();
        });
    });

    it('has something usefull on POST /api/v2/create-order', function (done) {
      supertest(app)
        .post('/api/v2/create-order')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          address1: 'Lenin\'s street',
          address2: 'house 10 flat 5',
          campaignId: '', //blank? strange
          cardMonth: '4444111144441111',
          cardNumber: '12',
          cardYear: '20',
          city: 'New York',
          emailAddress: 'testing@mail.ru',
          firstName: 'testing',
          lastName: 'testing',
          orderId: '', //blank?
          phoneNumber: '222-222-4444',
          postalCode: '00054',
          productId: '',
          state: 'NY',
          _csrf: createOrderCSRFToken
        })
        .expect(200, function (error, res) {
          if (error) {
            return done(error);
          }
          if (res.body.success) {
            res.body.orderId.should.exist;
          } else {
            res.body.error.should.exist;
          }
          return done();
        });
    });
    it('has 403 on POST /api/v2/create-order with missing CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/create-order')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          someSaneData: 'to be entered here',
          //_csrf: 'Во имя Отца, и Сына, и Святаго духа, аминь!'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/create-order with bad CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/create-order')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          someSaneData: 'to be entered here',
          _csrf: 'Во имя Отца, и Сына, и Святаго духа, аминь!'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/create-order with wrong entryPoint', function (done) {
      supertest(app)
        .post('/api/v2/create-order')
        .set('Cookie', [util.format('PHPSESSID=%s', taintedSessionId)])
        .send({
          someSaneData: 'to be entered here',
          _csrf: taintedCsrfToken
        })
        .expect(403, 'Invalid API Key', done);
    });
  });
  describe('/api/v2/upsell', function () {
    let upselCSRFToken;

    it('has anything on / but we need to start session properly to run tests', function (done) {
      supertest(app)
        .get('/')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .expect('X-Powered-By', 'TacticalMastery')
        .end(function (error, res) {
          if (error) {
            return done(error);
          }
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          upselCSRFToken = csrf;
          done();
        });
    });

    it('has something usefull on POST /api/v2/upsell', function (done) {
      supertest(app)
        .post('/api/v2/upsell')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          orderId: 'C10D785CD0',
          productId: 115,
          productQty: 1,
          _csrf: upselCSRFToken
        })
        .expect(200, function (error, res) {
          if (error) {
            return done(error);
          }
          if (res.body.success) {
            res.body.orderId.should.exist;
          } else {
            res.body.error.should.exist;
          }
          return done();
        });


    });
    it('has 403 on POST /api/v2/create-upsell with missing CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/create-upsell')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          someSaneData: 'to be entered here',
          // _csrf: 'Во имя Отца, и Сына, и Святаго духа, аминь!'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/create-upsell with bad CSRF token', function (done) {
      supertest(app)
        .post('/api/v2/create-upsell')
        .set('Cookie', [util.format('PHPSESSID=%s', sessionId)])
        .send({
          someSaneData: 'to be entered here',
          _csrf: 'Во имя Отца, и Сына, и Святаго духа, аминь!'
        })
        .expect(403, 'Invalid API Key', done);
    });
    it('has 403 on POST /api/v2/create-upsell with wrong entryPoint', function (done) {
      supertest(app)
        .post('/api/v2/create-upsell')
        .set('Cookie', [util.format('PHPSESSID=%s', taintedSessionId)])
        .send({
          someSaneData: 'to be entered here',
          _csrf: taintedCsrfToken
        })
        .expect(403, 'Invalid API Key', done);
    });
  });

  describe('operate with cookies disabled', function () {
    let
      headerSessionId,
      headerCSRFToken;

    it('has anything on / but we need to start cookieless session to run tests properly', function (done) {
      supertest(app)
        .get('/')
        .expect('X-Powered-By', 'TacticalMastery')
        .expect('phpsessid', /[a-zA-Z0-9\-]+/)
        .expect('XSRF-TOKEN', /[a-zA-Z0-9\-]+/)
        .end(function (error, res) {
          if (error) {
            return done(error);
          }
          // console.log('/api/v2/ping cookies ',res.headers['set-cookie']);
          let sId = extractCookie(res, sessionIdCookieRegex);
          if (sId === false) {
            return done(new Error('PHPSESSID cookie provided set!'));
          }
          let csrf = extractCookie(res, csrfTokenCookieRegex);
          if (csrf === false) {
            return done(new Error('XSRF-TOKEN not set!'));
          }
          headerSessionId = res.headers.phpsessid;
          done();
        });
    });
    it('has 200 and pong on /api/v2/ping', function (done) {
      supertest(app)
        .get('/api/v2/ping')
        .set('PHPSESSID', headerSessionId)
        .expect('X-Powered-By', 'TacticalMastery')
        .expect(200, {msg: 'PONG'})
        .expect('phpsessid', /[a-zA-Z0-9\-]+/)
        .expect('XSRF-TOKEN', /[a-zA-Z0-9\-]+/)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          headerCSRFToken = res.headers['xsrf-token'];
          done();
        });
    });
    it('has 200 on POST /api/v2/add-contact', function (done) {
      supertest(app)
        .post('/api/v2/add-contact')
        .set('PHPSESSID', headerSessionId)
        .send({
          FirstName: 'test_FirstName',
          LastName: 'test_LastName',
          Email: 'test@email.com',
          Phone: '222-222-4444',
          _csrf: headerCSRFToken
        })
        .expect(200)
        .end(done);
    });
  });
});