$(function() {
  return;

  var $queue_col = $('#queue-column');
  var $song_input = $('#song-form input[type=file]');
  var $uploads_header = $('#uploads-header');
  var $uploads_container = $('#uploads-container');

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

  $('#btn-upload').click(function(e) {
    e.preventDefault();
  });

  var dropzone = new Dropzone('#queue-column', {
    url: '/song/upload',
    parallelUploads: true,
    maxFilesize: config.max_file_size,
    clickable: '#btn-upload',
    maxFiles: 10,
    previewsContainer: '#previews',
    previewTemplate: $('#upload-preview-template').html()
  });

  dropzone.on('addedfile', function(file) {
    $uploads_header.show();
    $uploads_container.show();
  });

  dropzone.on('reset', function() {
    $uploads_header.hide();
    $uploads_container.hide();
  });

  dropzone.on('error', function(file) {
    $(file.previewElement).find('.background').css(
      'background-color', 'red');
  });

  dropzone.on('success', function(file) {
    $(file.previewElement).find('.background').css(
      'background-color', 'green');

    setTimeout(function() {
      dropzone.removeFile(file);
    }, 4000);
  });
  
  $('#btn-close-uploads').click(function(e) {
    e.preventDefault();
    dropzone.removeAllFiles(true);
  }).tooltip({
    title: 'Cancel',
    trigger: 'hover'
  });

  $uploads_header.hide();
  $uploads_container.hide();
});

