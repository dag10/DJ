$(function() {
  var $queue_col = $('#queue-column');
  var $song_input = $('#song-form input[type=file]');

  $queue_col.on('dragover', function(e) {
    $(this).addClass('dragging');
  });

  $queue_col.on('dragleave', function() {
    $(this).removeClass('dragging');
  });

  $queue_col.on('drop', function(e) {
    $(this).removeClass('dragging');
    e.preventDefault();
  });

  $queue_col.dropzone({
    url: '/song/upload',
    parallelUploads: true,
    maxFilesize: 50,
    clickable: '#btn-upload',
    maxFiles: 10,
    previewsContainer: '#previews',
    previewTemplate: $('#upload-preview-template').html()
  });
});

