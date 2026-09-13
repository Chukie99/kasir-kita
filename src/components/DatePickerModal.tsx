import React, { useMemo, useState } from 'react'
import { View, Pressable, Modal } from 'react-native'
import { Text, Button } from 'react-native-paper'
import { colors } from '../theme/theme'

function toISO(d: Date) { return d.toISOString().slice(0,10) }
function parseISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s+'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}
function daysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function startDow(y: number, m: number) { return new Date(y, m, 1).getDay() }

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DOW = ['Mg','Sn','Sl','Rb','Km','Jm','Sb']

export default function DatePickerModal({ visible, value, onSelect, onClose }: { visible: boolean; value: string; onSelect: (iso: string)=>void; onClose: ()=>void }) {
  const init = parseISO(value) || new Date()
  const [y, setY] = useState(init.getFullYear())
  const [m, setM] = useState(init.getMonth())
  React.useEffect(()=>{ const d=parseISO(value); if(d){ setY(d.getFullYear()); setM(d.getMonth()) }}, [value, visible])
  const grid = useMemo(()=>{
    const dim = daysInMonth(y,m)
    const off = startDow(y,m)
    const cells: (number|null)[] = []
    for(let i=0;i<off;i++) cells.push(null)
    for(let d=1; d<=dim; d++) cells.push(d)
    while(cells.length%7!==0) cells.push(null)
    return cells
  }, [y,m])
  const selectDay = (d: number) => { onSelect(toISO(new Date(y,m,d))); onClose() }
  const go = (delta: number) => { let nm=m+delta, ny=y; if(nm<0){nm=11;ny--} else if(nm>11){nm=0;ny++}; setM(nm); setY(ny) }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', padding:20 }}>
        <Pressable onPress={()=>{}} style={{ backgroundColor:'#FFF', borderRadius:16, padding:16, borderWidth:1, borderColor: colors.border }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <Pressable onPress={()=>go(-1)} hitSlop={10} style={{ padding:8 }}><Text style={{ fontSize:18, fontWeight:'800' }}>‹</Text></Pressable>
            <Text style={{ fontSize:15, fontWeight:'800', color: colors.text }}>{MONTHS[m]} {y}</Text>
            <Pressable onPress={()=>go(1)} hitSlop={10} style={{ padding:8 }}><Text style={{ fontSize:18, fontWeight:'800' }}>›</Text></Pressable>
          </View>
          <View style={{ flexDirection:'row', marginBottom:6 }}>
            {DOW.map(d=><Text key={d} style={{ flex:1, textAlign:'center', fontSize:11, fontWeight:'800', color: colors.textMuted }}>{d}</Text>)}
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
            {grid.map((d,i)=>{
              const isSel = d!=null && value===toISO(new Date(y,m,d))
              const isToday = d!=null && toISO(new Date())===toISO(new Date(y,m,d))
              return (
                <View key={i} style={{ width:'14.28%', padding:2 }}>
                  {d==null ? <View style={{ height:36 }} /> : (
                    <Pressable onPress={()=>selectDay(d)} style={{ height:36, borderRadius:18, alignItems:'center', justifyContent:'center', backgroundColor: isSel ? colors.green : isToday ? colors.chipBg : '#FFF', borderWidth: isToday && !isSel ? 1 : 0, borderColor: colors.green }}>
                      <Text style={{ fontSize:13, fontWeight: isSel ? '800':'600', color: isSel ? '#FFF': colors.text }}>{d}</Text>
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
          <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
            <Button mode="text" onPress={onClose} textColor={colors.textMuted} style={{ flex:1 }}>Batal</Button>
            <Button mode="contained" onPress={()=>{ onSelect(toISO(new Date())); onClose() }} style={{ flex:1 }}>Hari ini</Button>
          </View>
          <Text style={{ fontSize:10, color: colors.textMuted, textAlign:'center', marginTop:8 }}>Tap tanggal — langsung keisi</Text>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
