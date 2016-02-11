'use strict';

const conf = require('./configs');
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const logger = require('winston');
const passport = require('passport');
const VkStrategy = require('passport-vkontakte').Strategy;
const storage = require('./storage')(logger);
const vk = require('./vkApi')(logger);
const roomEndpoints = require('./roomEndpoints')(storage, logger, vk);

const app = express();
app.set('port', conf.port);
app.set('view engine', 'jade');
app.set('views', './src/views');
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
    strategy: 'vkontakte',
    remoteID: profile.id,
    username: profile.username,
    name: profile.displayName,
    photoURL: profile.photos[0].value,
    profileURL: profile.profileUrl,
    accessToken,
  };
  return storage.createUser(user).then(u => done(null, u));
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

app.get('/auth/vk', passport.authenticate('vkontakte', { scope: ['audio', 'offline'] }));

app.get('/auth/vk/callback', passport.authenticate('vkontakte', { failureRedirect: '/auth' }),
  (req, res) => {
    res.redirect('/');
  });

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

app.listen(app.get('port'), () => {
  logger.info(`Node app is running port ${app.get('port')}`);
});
