'use strict';

const logger = require('winston');
const PromiseA = require('bluebird');
const uuid = require('node-uuid');

const roomsRepository = {};
const usersRepository = {};
const Storage = {};

Storage.createUser = PromiseA.method(function(user) {
  const userID = uuid.v4();
  user.id = userID;
  usersRepository[userID] = user;
  logger.info(`New user: ${user}`);
  return user;
});

Storage.createRoom = PromiseA.method(function(user) {
  if (!user || !user.id) throw new Error("User can't be null");
  const roomID = uuid.v4();
  const room = {
    id: roomID,
    ownerID: user.id,
    tracks: {
      current: 0,
      list: []
    },
    updatedAt: new Date(),
    createdAt: new Date()
  }
  roomsRepository[roomID] = room;
  logger.info(`New room ${room}`);
  return room;
});

Storage.findRoom = PromiseA.method(function(id) {
  if (!id) throw new Error("Room ID can't be null");
  const room = roomsRepository[id];
  if (room) return room;
  throw new Error(`Room with id ${id} not found`);
});

Storage.addTrack = PromiseA.method(function(roomID, audio) {
  if (!audio || typeof(audio) != 'object') throw new Error("Audios can't be null");
  return Storage.findRoom(roomID).then(room => {
    room.tracks.list.push(audio);
    logger.info(`Added track to room ${roomID} ${JSON.stringify(audio)}`);
    return room;
  });
});

Storage.nextTrack = PromiseA.method(function(user, roomID) {
  if (!roomID) throw new Error("Room ID can't be null");
  if (!user) throw new Error("User can't be null");
  return Storage.findRoom(roomID).then(room => {
    if (room.ownerID != user.id) throw new Error(`User ${user.id} can't control Room ${room.id}`);
    if (room.tracks.list.length <= room.tracks.current + 1) {
      room.tracks.current = room.tracks.list.length
    } else {
      room.tracks.current++;
    }
    const track = room.tracks.list[room.tracks.current];
    if (track) return track;
    throw new Error(`Nothing to play next in room ${roomID}`);
  });
});

Storage.currentTrack = PromiseA.method(function(user, roomID) {
  if (!roomID) throw new Error("Room ID can't be null");
  if (!user) throw new Error("User can't be null");
  return Storage.findRoom(roomID).then(room => {
    if (room.ownerID != user.id) throw new Error(`User ${user.id} can't control Room ${room.id}`);
    const track = room.tracks.list[room.tracks.current];
    if (track) return track;
    throw new Error(`Nothing to play in room ${roomID}`);
  });
});

module.exports = Storage;
