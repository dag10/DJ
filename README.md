DJ
==

A web service to let multiple users take turns in playing music over a computer
connected stereo. Inspired by the late
[turntable.fm](https://web.archive.org/web/20140110131633/http://blog.turntable.fm/post/67777306411/turntable-live-turntable-fm).

Although I'm building this for use in the [Computer Science House](http://csh.rit.edu),
it should be easily deployable elsewhere.

It's still a work in progress. Here's a screenshot:
![Screenshot](/screenshot.png)

For a standalone client, see [DJ Listener](https://github.com/dag10/DJ-Listener).

Installation
--
First, setup a new mysql database.

Then enter the project directory and run `npm install` to install the
dependencies.

Install the following packages with your system's package manager:
- lame
- ffmpeg

Then rename config.example.js to config.js and set up the configuration.

Launch the server and migrations will be executed automatically, populating
the database.

Installing Plugins
--
To install music sources such as Soundcloud, follow the instructions on the
[Installing Music Source Plugins](https://github.com/dag10/DJ/wiki/Installing-Music-Source-Plugins)
section of the wiki.

Updating
--
When updating an existing installation, restart the server. When it starts,
it will automatically run the necessary migrations.

Running
--
To run, type `node app.js`.

Troubleshooting
--
Please see the [Toubleshooting](https://github.com/dag10/DJ/wiki/Troubleshooting)
section of the wiki. If your problem isn't listed,
[contact me](mailto:gottlieb.drew@gmail.com) or file an issue.

--

[![CSH Logo](http://csh.rit.edu/images/logo.png)](http://csh.rit.edu)

