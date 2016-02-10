'use strict';

module.exports = (storage, logger, vk) => {
  const handlers = {};

  handlers.createRoom = (req, res) => {
    storage.createRoom(req.user).then(room => {
      res.redirect(`/room/${room.id}`);
    }).catch(err => {
      logger.error(err);
      res.status(400).send(err.toString());
    });
  };

  handlers.showRoom = (req, res) => {
    const id = req.params.id;
    storage.findRoom(id).then(room => {
      let owner = false;
      if (req.user && req.user.id === room.ownerID) {
        owner = true;
      }
      res.render('room', { room: room, owner: owner });
    }).catch(err => {
      logger.error(err);
      res.status(404).send(err.toString());
    });
  };

  handlers.addTrackToRoom = (req, res) => {
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
  };

  handlers.nextTrackInRoom = (req, res) => {
    const user = req.user;
    const roomID = req.params.id;
    if (!user) res.redirect(`/room/${roomID}`);
    storage.nextTrack(user, roomID).then(audio => {
      return vk.findAudioById(user.accessToken, audio.id);
    }).then(track => {
      res.send(track);
    }).catch(err => {
      logger.error(err);
      res.status(404).send(err.toString());
    });
  };

  handlers.currentTrackInRoom = (req, res) => {
    const user = req.user;
    const roomID = req.params.id;
    if (!user) res.redirect(`/room/${roomID}`);
    storage.currentTrack(user, roomID).then(audio => {
      return vk.findAudioById(user.accessToken, audio.id);
    }).then(track => {
      res.send(track);
    }).catch(err => {
      logger.error(err);
      res.status(404).send(err.toString());
    });
  };

  handlers.searchAudio = (req, res) => {
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
      return vk.findAudio(user.accessToken, q).then(audios => {
        res.render('addAudio', { room: room, audios: audios });
      });
    }).catch(err => {
      logger.error(err);
      res.status(400).send(err.toString());
    });
  };

  return handlers;
};
