(function($) {
  'use strict';
  $(document).ready(function() {
    var sound = null;

    function play(url, roomID) {
      if (!sound) sound = new Audio();
      sound.currentTime = 0;
      sound.src = url;
      sound.onended = function() {
        playNext(roomID);
      }
      sound.play();
    }

    function playNext(roomID) {
      $.ajax({
        method: 'POST',
        url: '/room/'+roomID+'/next',
        success: function(data) {
          console.log(data);
          play(data.url, roomID);
        }
      });
    }

    $('#play').on('click', function() {
      var $this = $(this);
      var roomID = $this.data('room');
      if (sound) {
        if (sound.paused) {
          sound.play();
        } else {
          sound.pause();
        }
        return;
      }
      $.ajax({
        method: 'GET',
        url: '/room/'+roomID+'/current',
        success: function(data) {
          console.log(data);
          play(data.url, roomID);
        }
      });
    });

    $('#next').on('click', function() {
      var $this = $(this);
      var roomID = $this.data('room');
      playNext(roomID);
    });
  });
})(jQuery);
