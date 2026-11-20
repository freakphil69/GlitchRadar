import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipRow } from '@/src/components/ChipRow';
import { GlitchCard } from '@/src/components/GlitchCard';
import { useGlitches } from '@/src/lib/queries';
import { useNow } from '@/src/lib/useNow';
import { fonts, makeStyles, spacing, useTheme } from '@/src/theme';
const KEY='glitchradar.searchCity.v1';
const MODES=[{key:'price_error',label:'PREISFEHLER'},{key:'all',label:'MÄRKTE'},{key:'temu',label:'TEMU TOP 10'},{key:'delivery',label:'ESSEN & CODES'},{key:'drops',label:'DROPS'},{key:'ending',label:'LÄUFT BALD AB'},{key:'black',label:'BLACK WEEK'}];
const SHOPS=['Alle','Temu','AliExpress','Amazon','MediaMarkt','Saturn','Epic Games','Vinted','markt.de','Otto','Cyberport','Alternate','Galaxus','Alza','Reichelt','Pollin'];
export default function MarketsScreen(){
  const styles=useStyles();const {colors}=useTheme();const insets=useSafeAreaInsets();const now=useNow();
  const [mode,setMode]=useState('price_error');const [shop,setShop]=useState('Alle');const [search,setSearch]=useState('');
  const [city,setCity]=useState('');const [appliedCity,setAppliedCity]=useState('');const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const request=useRef(0);
  useEffect(()=>{let active=true;AsyncStorage.getItem(KEY).then(value=>{if(active&&request.current===0&&value){setCity(value);setAppliedCity(value);}}).catch(()=>{}).finally(()=>{if(active)setReady(true);});return()=>{active=false;request.current++;};},[]);
  useEffect(()=>{if(ready)AsyncStorage.setItem(KEY,appliedCity).catch(()=>{});},[appliedCity,ready]);
  const selected=mode==='temu'?'Temu':mode==='all'?shop:'Alle';
  const filters=useMemo(()=>({type:mode==='price_error'?'price_error':mode==='delivery'?'delivery':'all',sort:'new',minDiscount:0,shops:selected==='Alle'?[]:[selected],categories:[],q:mode==='delivery'?appliedCity:''}),[mode,selected,appliedCity]);
  const list=useGlitches(filters);
  const rows=useMemo(()=>{
    const term=search.trim().toLowerCase();let result=(list.data??[]).filter(g=>g.status==='active'&&(!g.expires_at||new Date(g.expires_at).getTime()>now)&&[g.title,g.shop,g.category,g.description].join(' ').toLowerCase().includes(term));
    if(mode==='temu')result=result.filter(g=>g.shop.trim().toLowerCase()==='temu'&&g.currency==='EUR'&&typeof g.glitched_price==='number'&&Number.isFinite(g.glitched_price)&&g.glitched_price>=0).sort((a,b)=>a.glitched_price!-b.glitched_price!||a.id.localeCompare(b.id)).slice(0,10);
    if(mode==='drops')result=result.filter(g=>/limited|limitiert|drop|release|sneaker/i.test(g.title+' '+g.description));
    if(mode==='black')result=result.filter(g=>/black friday|black week|cyber monday/i.test(g.title+' '+g.description));
    if(mode==='ending')result=result.filter(g=>g.expires_at&&new Date(g.expires_at).getTime()-now<=86400000).sort((a,b)=>Date.parse(a.expires_at!)-Date.parse(b.expires_at!));
    return result;
  },[list.data,search,mode,now]);
  const locate=async()=>{
    const id=++request.current;setBusy(true);setMessage('');let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const permission=await Location.requestForegroundPermissionsAsync();if(id!==request.current)return;
      if(permission.status!=='granted')throw new Error('Standort nicht freigegeben. Stadt oder PLZ kannst du weiterhin manuell wählen.');
      const position=await Promise.race([Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Standortabfrage dauert zu lange. Bitte Stadt manuell wählen.')),12000);})]);
      if(id!==request.current)return;
      const places=await Location.reverseGeocodeAsync(position.coords);if(id!==request.current)return;
      const place=places[0];const value=place?.city||place?.postalCode;
      if(!value)throw new Error('Kein Ort ermittelt. Bitte Stadt oder PLZ eingeben.');
      setCity(value);setAppliedCity(value);setMessage('Suchort übernommen. Du kannst jederzeit eine andere Stadt wählen.');
    }catch(error){if(id===request.current)setMessage(error instanceof Error?error.message:'Standort nicht verfügbar.');}
    finally{if(timer)clearTimeout(timer);if(id===request.current)setBusy(false);}
  };
  return <View style={[styles.screen,{paddingTop:insets.top}]}>
    <Text style={styles.title}>MÄRKTE & PREISFEHLER</Text>
    <ChipRow options={MODES} value={mode} onChange={setMode}/>
    {mode==='all'?<ChipRow options={SHOPS.map(value=>({key:value,label:value.toUpperCase()}))} value={shop} onChange={setShop}/>:null}
    {mode==='delivery'?<View style={styles.panel}>
      <TextInput value={city} onChangeText={value=>{request.current++;setBusy(false);setCity(value);}} maxLength={80} accessibilityLabel='Beliebige Stadt oder PLZ wählen' placeholder='Andere Stadt oder PLZ' placeholderTextColor={colors.muted} style={styles.input}/>
      <View style={styles.buttons}>
        <Pressable accessibilityRole='button' style={styles.button} onPress={()=>{request.current++;setBusy(false);setAppliedCity(city.trim());setMessage('');}}><Text style={styles.action}>ORT ANWENDEN</Text></Pressable>
        <Pressable accessibilityRole='button' style={styles.button} disabled={busy} onPress={()=>{void locate();}}><Text style={styles.action}>{busy?'ORT WIRD GESUCHT …':'MEIN STANDORT'}</Text></Pressable>
        <Pressable accessibilityRole='button' style={styles.button} onPress={()=>{request.current++;setBusy(false);setCity('');setAppliedCity('');setMessage('');}}><Text style={styles.action}>ÜBERREGIONAL</Text></Pressable>
      </View>
      <Text style={styles.note}>Suchort: {appliedCity||'überregional'}. Ortsnennungen im Feed sind keine bestätigten Liefergebiete. Coupons, Teilnahme, Mindestbestellwert und persönliche Bedingungen beim Anbieter prüfen. Keine Bestellung über GlitchRadar.</Text>
      {message?<Text accessibilityLiveRegion='polite' style={styles.note}>{message}</Text>:null}
    </View>:null}
    <TextInput value={search} onChangeText={setSearch} accessibilityLabel='Im geladenen Feed suchen' placeholder='Geladene Angebote durchsuchen' placeholderTextColor={colors.muted} style={[styles.input,{marginHorizontal:spacing.lg}]}/>
    <FlatList data={rows} keyExtractor={g=>g.id} renderItem={({item,index})=><GlitchCard glitch={item} index={index}/>} contentContainerStyle={styles.list} keyboardShouldPersistTaps='handled' refreshing={list.isRefetching&&!list.isLoading} onRefresh={()=>{void list.refetch();}}
      ListHeaderComponent={<Text style={styles.note}>{mode==='temu'?'Bis zu zehn günstigste EUR-Artikel im geladenen Temu-Feed, ohne Versand. Kein vollständiger Marktvergleich.':'Es werden nur vorhandene Feed-Angebote angezeigt. Händlerauswahl bindet keine neue Datenquelle an. Drops sind Texthinweise, keine bestätigte Limitierung.'}{list.isError&&rows.length?' Aktualisierung fehlgeschlagen; zuletzt geladener Stand.':''}</Text>}
      ListEmptyComponent={<View style={styles.panel}>{list.isLoading?<ActivityIndicator/>:null}<Text style={styles.note}>{list.isLoading?'Angebote werden geladen …':list.isError?'Backend nicht erreichbar.':'Keine passenden Angebote in den gelieferten Daten. Keine erfundenen Preise oder Coupons.'}</Text><Pressable accessibilityRole='button' style={styles.button} onPress={()=>{void list.refetch();}}><Text style={styles.action}>ERNEUT LADEN</Text></Pressable></View>}/>
  </View>;
}
const useStyles=makeStyles(c=>({screen:{flex:1,backgroundColor:c.surface},title:{fontFamily:fonts.display,fontSize:24,color:c.onSurface,padding:spacing.lg},panel:{padding:spacing.md,gap:spacing.sm},input:{minHeight:44,padding:spacing.sm,borderWidth:1,borderColor:c.border,color:c.onSurface,backgroundColor:c.surfaceTertiary},buttons:{flexDirection:'row' as const,flexWrap:'wrap' as const,gap:spacing.sm},button:{minHeight:44,justifyContent:'center' as const,paddingHorizontal:spacing.sm},action:{fontFamily:fonts.mono,color:c.brandPrimary,fontSize:11},note:{fontFamily:fonts.textRegular,color:c.muted,fontSize:12,lineHeight:17},list:{padding:spacing.lg,gap:spacing.md}}));
