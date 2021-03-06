'use strict';

const conf = require('./configs');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const VkStrategy = require('passport-vkontakte').Strategy;
const mongoose = require('mongoose');

module.exports = (logger) => {
  const storage = require('./storageMongo')(logger, conf);
  const vk = require('./vkApi')(logger);
  const roomEndpoints = require('./roomEndpoints')(storage, logger, vk);

  const app = express();
  app.set('port', conf.port);
  app.set('view engine', 'jade');
  app.set('views', './server/views');
  app.use('/static', express.static('client'));
  app.use(morgan('combined'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(session({
    secret: conf.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {},
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new VkStrategy({
    clientID: conf.clientID,
    clientSecret: conf.clientSecret,
    callbackURL: `${conf.host}/auth/vk/callback`,
    version: '5.44',
  }, (accessToken, refreshToken, profile, done) => {
    const user = {
      provider: 'vkontakte',
      remoteID: profile.id,
      username: profile.username,
      name: profile.displayName,
      photoURL: profile.photos[0].value,
      profileURL: profile.profileUrl,
      accessToken,
      refreshToken,
    };
    return storage.createUser(user)
      .then(u => done(null, u))
      .catch(err => done(err));
  }));

  passport.serializeUser((user, done) => {
    done(null, JSON.stringify(user));
  });

  passport.deserializeUser((obj, done) => {
    done(null, JSON.parse(obj));
  });

  app.get('/', (req, res) => {
    res.render('index', { user: req.user });
  });

  app.get('/auth/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });

  app.get('/auth/vk', passport.authenticate('vkontakte', { scope: ['audio', 'offline'] }));

  app.get('/auth/vk/callback',
    passport.authenticate('vkontakte', { successRedirect: '/', failureRedirect: '/' }));

  // POST: /room - create new room with random id
  app.post('/room', roomEndpoints.createRoom);

  // GET: /rooms - return list of all visited rooms
  // app.get('/rooms', (req, res) => {});

  // GET: /room - connect to the room and see current track
  app.get('/room/:id', roomEndpoints.showRoom);

  // POST: /room/:id/next - start next track and get it info
  app.post('/room/:id/next', roomEndpoints.nextTrackInRoom);

  app.get('/room/:id/current', roomEndpoints.currentTrackInRoom);

  // POST: /room/:id/audio/:aid - add track to room by vk audio id
  app.post('/room/:id/audio', roomEndpoints.addTrackToRoom);

  app.get('/room/:id/audio', roomEndpoints.searchAudio);

  function listen() {
    app.listen(app.get('port'), () => {
      logger.info(`Node app is running port ${app.get('port')}`);
    });
  }

  function connectDB() {
    const options = { server: { socketOptions: { keepAlive: 1 } } };
    mongoose.connect(conf.mongoURI, options).connection
      .on('error', logger.error.bind(logger, 'connection error:'))
      .on('disconnect', connectDB)
      .once('open', listen);
  }

  return {
    app,
    start: () => {
      connectDB();
    },
  };
};
