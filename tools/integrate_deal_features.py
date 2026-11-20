from pathlib import Path
import json, shutil
root=Path(__file__).resolve().parent.parent
for source,target in [('offerPolicy.ts','src/lib/offerPolicy.ts'),('test-offer-policy.cjs','scripts/test-offer-policy.cjs'),('markets.tsx','app/(tabs)/markets.tsx')]:
    destination=root/'frontend'/target
    assert not destination.exists(), str(destination)+' already exists'
    shutil.copyfile(root/'tools/deal-feature'/source,destination)
p=root/'frontend/src/lib/queries.ts';s=p.read_text()
s='import { filterAllowed, isAllowedOffer } from "./offerPolicy";\n'+s
for key in ['["glitches", filters]','["alarm"]','["codes", shop]']:
    anchor='queryKey: '+key+','
    assert s.count(anchor)==1,anchor
    s=s.replace(anchor,anchor+'\n    select: (rows) => filterAllowed(rows),',1)
anchor='queryKey: ["glitch", id],';assert s.count(anchor)==1
s=s.replace(anchor,anchor+'\n    select: (offer) => { if (!isAllowedOffer(offer)) throw new Error("Dieses Angebot ist aufgrund der Inhaltsrichtlinie ausgeblendet."); return offer; },',1);p.write_text(s)
p=root/'frontend/app/(tabs)/stash.tsx';s=p.read_text();anchor='const items = stash.data ?? [];';assert anchor in s
p.write_text('import { isAllowedOffer } from "@/src/lib/offerPolicy";\n'+s.replace(anchor,'const items = (stash.data ?? []).filter(item => isAllowedOffer(item.glitch));',1))
p=root/'frontend/app/(tabs)/_layout.tsx';s=p.read_text()
anchor='<NativeTabs.Trigger name="codes">';assert s.count(anchor)==1
s=s.replace(anchor,'<NativeTabs.Trigger name="markets"><NativeTabs.Trigger.Icon sf="cart" /><NativeTabs.Trigger.Label>Märkte</NativeTabs.Trigger.Label></NativeTabs.Trigger>\n        '+anchor,1)
anchor='<Tabs.Screen\n          name="codes"';assert s.count(anchor)==1
s=s.replace(anchor,'<Tabs.Screen name="markets" options={{ title: "MÄRKTE", tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cart" size={22} color={color} /> }} />\n        '+anchor,1);p.write_text(s)
p=root/'frontend/app.json';data=json.loads(p.read_text());plugins=data['expo'].setdefault('plugins',[])
assert not any((v if isinstance(v,str) else v[0])=='expo-location' for v in plugins)
plugins.append(['expo-location',{'locationWhenInUsePermission':'Deinen Standort nur auf Wunsch als Suchort für Angebote übernehmen. Andere Städte kannst du manuell wählen.','isAndroidBackgroundLocationEnabled':False,'isAndroidForegroundServiceEnabled':False}]);p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
