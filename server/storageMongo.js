'use strict';

const PromiseA = require('bluebird');
const mongoose = require('mongoose');
mongoose.Promise = PromiseA;
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: { type: String, default: '' },
  name: { type: String, default: '' },
  provider: { type: String, default: '' },
  photoURL: { type: String, default: '' },
  profileURL: { type: String, default: '' },
  remoteID: { type: String, default: '' },
  accessToken: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

const RoomSchema = new Schema({
  _ownerID: Schema.Types.ObjectId,
  tracks: [{}],
  currentTrack: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = (logger) => {
  const User = mongoose.model('User', UserSchema);
  const Room = mongoose.model('Room', RoomSchema);

  const Storage = {};

  Storage.createUser = PromiseA.method(userData =>
    User.findOne({ remoteID: userData.remoteID, provider: userData.provider })
    .then(oldUser => {
      if (oldUser) {
        oldUser.accessToken = userData.accessToken;
        return oldUser.save().then(u => {
          logger.info(`Old user updated: ${JSON.stringify(u)}`);
          return u;
        }).catch(err => {
          logger.error(`Can't update user ${JSON.stringify(oldUser)}: ${JSON.stringify(err)}`);
          throw err;
        });
      }

      const user = new User(userData);
      return user.save().then(u => {
        logger.info(`New user: ${JSON.stringify(u)}`);
        return u;
      }).catch(err => {
        logger.error(`Can't create user ${JSON.stringify(user)}: ${JSON.stringify(err)}`);
        throw err;
      });
    })
  );

  Storage.createRoom = PromiseA.method(user => {
    if (!user || !user._id) throw new Error("User can't be null");
    const room = new Room({
      _ownerID: user._id,
      tracks: [],
      currentTrack: 0,
    });

    return room.save().then(r => {
      logger.info(`New room: ${JSON.stringify(r)}`);
      return r;
    }).catch(err => {
      logger.error(`Can't create user ${JSON.stringify(user)}: ${JSON.stringify(err)}`);
      throw err;
    });
  });

  Storage.findRoom = PromiseA.method(id => {
    if (!id) throw new Error("Room ID can't be null");
    return Room.findById(id).then(room => {
      if (!room) throw Error(`Room not found with id=${id}`);
      return room;
    });
  });

  Storage.findUserRoom = PromiseA.method((id, userID) => {
    if (!id) throw new Error("Room ID can't be null");
    if (!userID) throw new Error("User ID can't be null");
    logger.info(`roomID: ${id}, ownerID: ${userID}`);
    return Room.findById(id).where({ _ownerID: userID }).then(room => {
      if (!room) throw Error(`Room not found with id=${id} and onwerID=${userID}`);
      return room;
    });
  });

  Storage.addTrack = PromiseA.method((roomID, audio) => {
    if (!roomID) throw new Error("Room id can't be null");
    if (!audio) throw new Error("Audios can't be null");
    return Storage.findRoom(roomID).then(room => {
      room.tracks.push(audio);
      logger.info(`Added track to room ${roomID} ${JSON.stringify(audio)}`);
      return room.save();
    });
  });

  Storage.nextTrack = PromiseA.method((user, roomID) => {
    if (!roomID) throw new Error("Room ID can't be null");
    if (!user) throw new Error("User can't be null");
    return Storage.findUserRoom(roomID, user._id).then(room => {
      if (room.tracks.length <= room.currentTrack + 1) {
        room.currentTrack = room.tracks.length;
      } else {
        room.currentTrack++;
      }
      return room.save()
        .then(() => Storage.currentTrack(user, roomID));
    });
  });

  Storage.currentTrack = PromiseA.method((user, roomID) => {
    if (!roomID) throw new Error("Room ID can't be null");
    if (!user) throw new Error("User can't be null");
    return Storage.findUserRoom(roomID, user._id).then(room => {
      logger.info(`Find room for user: ${JSON.stringify(room)}`);
      const track = room.tracks[room.currentTrack];
      if (track) return track;
      throw new Error(`Nothing to play in room ${roomID}`);
    });
  });

  return Storage;
};
