'use strict';

const conf = require('./configs');
const PromiseA = require('bluebird');
const request = PromiseA.promisifyAll(require('request'));
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const logger = require('winston');
const passport = require('passport');
const VkStrategy = require('passport-vkontakte').Strategy;
const jade = require('jade');

function findAudio(accessToken, query) {
  let url = encodeURI(`https://api.vk.com/method/audio.search?auto_complete=1&sort=2&q=${query}&access_token=${accessToken}`);
  logger.info(`Find audio: ${url}`);
  return request.getAsync(url).then(data => JSON.parse(data.body));
}

const app = express();
app.set('port', conf.port);
app.set('view engine', 'jade');
app.set('views', './views');
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: conf.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: {}
}));
app.use(passport.initialize());
app.use(passport.session());

const users = {};

passport.use(new VkStrategy({
  clientID: conf.clientID,
  clientSecret: conf.clientSecret,
  callbackURL: `${conf.host}/auth/vk/callback`,
  version: '5.44'
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    userID: profile.id,
    username: profile.username,
    name: profile.displayName,
    photoURL: profile.photos[0].value,
    profileURL: profile.profileUrl,
    accessToken: accessToken
  };
  logger.info(`New user: ${user}`);
  users[user.userID] = user;
  return done(null, user);
}));

passport.serializeUser(function(user, done) {
  done(null, JSON.stringify(user));
});

passport.deserializeUser(function(obj, done) {
  done(null, JSON.parse(obj));
});

app.get('/', (req, res) => {
  res.render('index', {user: req.user});
});

app.get('/audio', (req, res) => {
  const user = req.user;
  const q = req.query.q || 'Нейромонах Феофан';
  if (user) {
    findAudio(user.accessToken, q).then(data => {
      res.redirect(data.response[1].url);
    }).catch(err => {
      logger.error(err);
      res.status(400).send(err);
    });
  } else {
    res.redirect('/');
  }
});

app.get('/auth/vk', passport.authenticate('vkontakte', {scope: ['audio', 'offline']}), (req, res) => {});

app.get('/auth/vk/callback', passport.authenticate('vkontakte', {failureRedirect: '/auth'}), (req, res) => {
  res.redirect('/');
});

app.listen(app.get('port'), () => {
  logger.info(`Node app is running port ${app.get('port')}`);
});
