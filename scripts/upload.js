$(function() {
  var $queue_col = $('#queue-column');
  var $song_input = $('#song-form input[type=file]');
  var $uploads_header = $('#uploads-header');

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

  var dropzone = new Dropzone('#queue-column', {
    url: '/song/upload',
    parallelUploads: true,
    maxFilesize: 50,
    clickable: '#btn-upload',
    maxFiles: 10,
    previewsContainer: '#previews',
    previewTemplate: $('#upload-preview-template').html()
  });

  dropzone.on('addedfile', function(file) {
    $uploads_header.show();
  });

  dropzone.on('reset', function() {
    $uploads_header.hide();
  });
  
  $('#btn-close-uploads').click(function(e) {
    e.preventDefault();
    dropzone.removeAllFiles(true);
  }).tooltip({
    title: 'Cancel',
    trigger: 'hover'
  });

  $uploads_header.hide();
});

