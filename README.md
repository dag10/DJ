DJ
==

A web service to let multiple users take turns in playing music over a computer
connected stereo. Inspired by the late
[turntable.fm](https://web.archive.org/web/20140110131633/http://blog.turntable.fm/post/67777306411/turntable-live-turntable-fm).

I'm building this for use in the [Computer Science House](http://csh.rit.edu),
but it should be easily deployable elsewhere.

It's still a work in progress. Here's a screenshot:
![Screenshot](/screenshot.png)

Installation
--
Enter the root directory, and run `npm install` to install the dependencies.

Then rename config.example.js to config.js and set up the configuration.

Launch the server and migrations will be executed automatically, populating
the database.

Install the following packages with your system's package manager:
- lame
- ffmpeg

Updating
--
When updating an existing installation, restart the server. When it starts,
it will automatically run the necessary migrations.

Running
--
To run, type `node app.js`.

--

[![CSH Logo](http://csh.rit.edu/images/logo.png)](http://csh.rit.edu)

