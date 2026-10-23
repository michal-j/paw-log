"""Assembles index.html: the app's own CSS (taken from the PDF proposal, which inlines it) + proposal.css + app.js. Run from this folder."""
src = open('../pdf-upload/index.html').read().split('\n')
css = '\n'.join(src[11:1146])
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>PawLog: Search across the log (JCB-138 proposal)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600;700&family=Onest:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
/* Inlined from the app so the prototype opens from disk: src/styles/tokens.css, global.css, components/controls.css,
   marks.css, day/day.css, tracked/tracked.css, photos/photos.css. The block "PROPOSED (JCB-138)" at the end is new. */
'''
tail = '''</style>
</head>
<body>
<div class="stage"><div class="phone" id="phone"></div></div>
<script src="sample-data.js"></script>
<script src="app.js"></script>
</body>
</html>
'''
open('index.html', 'w').write(head + css + '\n' + open('proposal.css').read() + tail)
