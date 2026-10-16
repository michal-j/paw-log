h=open('head.html').read(); s=open('script.js').read()
i=h.rstrip().rfind('</body>') 
if i>0: h=h[:i]
h=h.rstrip()
if h.endswith('</html>'): h=h[:-7]
h=h.rstrip()+'\n'
open('R10-Mint-Clean.dc.html','w').write(h+'''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
'''+s.rstrip()+'''
</script>
</body>
</html>
''')
