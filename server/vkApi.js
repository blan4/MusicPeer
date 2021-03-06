'use strict';

const PromiseA = require('bluebird');
const request = PromiseA.promisifyAll(require('request'));

const vkHost = 'https://api.vk.com';
const audioSearch = '/method/audio.search';
const audioByID = '/method/audio.getById';

module.exports = (logger) => {
  const VkApi = {};

  VkApi.findAudio = (accessToken, query) => {
    const uri = `${vkHost}${audioSearch}` +
      `?auto_complete=1&sort=2&q=${query}&access_token=${accessToken}`;
    const url = encodeURI(uri);
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
            duration: audio.duration,
          };
        }
      }).filter(el => !!el);
    });
  };

  VkApi.findAudioById = (accessToken, id) => {
    const url = encodeURI(`${vkHost}${audioByID}?audios=${id}&access_token=${accessToken}`);
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
        duration: audio.duration,
      };
    });
  };

  return VkApi;
};
