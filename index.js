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
const storage = require('./storage');

function findAudio(accessToken, query) {
  let url = encodeURI(`https://api.vk.com/method/audio.search?auto_complete=1&sort=2&q=${query}&access_token=${accessToken}`);
  logger.info(`Find audio: ${url}`);
  return request.getAsync(url).then(data => {
    const body = JSON.parse(data.body);
    logger.info(`Search audio: '${query}'`);
    return body.response.map(audio => {
      if (typeof(audio) === 'object' && 'url' in audio) {
        return {
          id: `${audio.owner_id}_${audio.aid}`,
          url: audio.url,
          artist: audio.artist,
          title: audio.title,
          duration: audio.duration
        }
      }
    }).filter(el => !!el);
  });
}

function findAudioById(accessToken, id) {
  let url = encodeURI(`https://api.vk.com/method/audio.getById?audios=${id}&access_token=${accessToken}`);
  logger.info(`Find audio: ${url}`);
  return request.getAsync(url).then(data => {
    logger.info(`Search audio by id: '${id}'`);
    const body = JSON.parse(data.body);
    const audio = body.response[0];
    return {
      id: `${audio.owner_id}_${audio.aid}`,
      url: audio.url,
      artist: audio.artist,
      title: audio.title,
      duration: audio.duration
    }
  });
}

const app = express();
app.set('port', conf.port);
app.set('view engine', 'jade');
app.set('views', './views');
app.use('/static', express.static('public'));
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
    strategy: 'vkontakte',
    remoteID: profile.id,
    username: profile.username,
    name: profile.displayName,
    photoURL: profile.photos[0].value,
    profileURL: profile.profileUrl,
    accessToken: accessToken
  };
  return storage.createUser(user).then(user => {
    return done(null, user);
  });
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

app.get('/auth/vk', passport.authenticate('vkontakte', {scope: ['audio', 'offline']}), (req, res) => {});

app.get('/auth/vk/callback', passport.authenticate('vkontakte', {failureRedirect: '/auth'}), (req, res) => {
  res.redirect('/');
});

//POST: /room - create new room with random id
app.post('/room', (req, res) => {
  storage.createRoom(req.user).then(room => {
    res.redirect(`/room/${room.id}`);
  }).catch(err => {
    logger.error(err);
    res.status(400).send(err.toString());
  });
});

//GET: /rooms - return list of all visited rooms
app.get('/rooms', (req, res) => {

});

//GET: /room - connect to the room and see current track
app.get('/room/:id', (req, res) => {
  const id = req.params.id;
  storage.findRoom(id).then(room => {
    let owner = false;
    if (req.user && req.user.id === room.ownerID) {
      owner = true;
    }
    res.render('room', {room: room, owner: owner});
  }).catch(err => {
    logger.error(err);
    res.status(404).send(err.toString());
  });
});

//POST: /room/:id/next - start next track and get it info
app.post('/room/:id/next', (req, res) => {
  const user = req.user;
  const roomID = req.params.id;
  if (!user) res.redirect(`/room/${roomID}`);
  storage.nextTrack(user, roomID).then(audio => {
    return findAudioById(user.accessToken, audio.id);
  }).then(track => {
    res.send(track);
  }).catch(err => {
    logger.error(err);
    res.status(404).send(err.toString());
  });
});

app.get('/room/:id/current', (req, res) => {
  const user = req.user;
  const roomID = req.params.id;
  if (!user) res.redirect(`/room/${roomID}`);
  storage.currentTrack(user, roomID).then(audio => {
    return findAudioById(user.accessToken, audio.id);
  }).then(track => {
    res.send(track);
  }).catch(err => {
    logger.error(err);
    res.status(404).send(err.toString());
  });
});

//POST: /room/:id/audio/:aid - add track to room by vk audio id
app.post('/room/:id/audio', (req, res) => {
  const id = req.params.id;
  if (!id) res.redirect('/');
  const user = req.user;
  if (!user) res.redirect(`/room/${id}`);
  const audio = req.body;
  if (!audio || !audio.id) res.status(400).send(`Form error ${audio}`);
  storage.addTrack(id, audio).then(() => {
    res.redirect(`/room/${id}`);
  }).catch(err => {
    logger.error(err);
    res.status(400).send(err.toString());
  });
});

app.get('/room/:id/audio', (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.redirect('/');
    return;
  }
  const user = req.user;
  if (!user) {
    res.redirect(`/`);
    return;
  }
  const q = req.query.q;
  if (!q) {
    res.redirect(`/room/${id}`);
    return;
  }
  storage.findRoom(id).then(room => {
    return findAudio(user.accessToken, q).then(audios => {
      res.render('addAudio', {room: room, audios: audios});
    });
  }).catch(err => {
    logger.error(err);
    res.status(400).send(err.toString());
  })
});

app.listen(app.get('port'), () => {
  logger.info(`Node app is running port ${app.get('port')}`);
});
