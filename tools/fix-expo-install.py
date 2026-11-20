import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'frontend/package.json';data=json.loads(p.read_text())
old=data['dependencies'].get('@expo/metro-runtime')
assert old in ('57.0.17','57.0.18'), 'Unexpected runtime version; inspect before changing'
data['dependencies']['@expo/metro-runtime']='57.0.18'
data['packageManager']='npm@11.19.1'
scripts=data.setdefault('scripts',{})
assert scripts.get('eas-build-pre-install') in (None,'npm install --global npm@11.19.1'), 'Existing pre-install hook must be reviewed'
scripts['eas-build-pre-install']='npm install --global npm@11.19.1'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
p=root/'frontend/eas.json';data=json.loads(p.read_text())
for name in ('preview','production'):
    data['build'][name]['node']='24.22.3'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
