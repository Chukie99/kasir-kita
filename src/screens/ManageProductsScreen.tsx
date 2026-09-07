import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native'
import { Text, Surface, Modal, TextInput, Switch, Button } from 'react-native-paper'
import { colors } from '../theme/theme'
import {
  listAllProducts, listCategories, addProduct, updateProduct,
  toggleProductActive, deleteProduct, addCategory, type ProductRow,
} from '../utils/products'

const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

interface EditingState { id: number | null; name: string; price: string; stock: string; imageUri: string | null; categoryId: number | null }
const EMPTY_EDIT: EditingState = { id: null, name: '', price: '', stock: '', imageUri: null, categoryId: null }

export default function ManageProductsScreen() {
  const [products, setProducts] = useState<ProductRow[]>(() => listAllProducts())
  const [categories, setCategories] = useState(() => listCategories())
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [newCat, setNewCat] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const refresh = () => setProducts(listAllProducts())

  const openAdd = () => setEditing({ ...EMPTY_EDIT })

  const openEdit = (p: ProductRow) =>
    setEditing({ id: p.id, name: p.name, price: String(p.price), stock: p.stock === null ? '' : String(p.stock), imageUri: p.image_uri, categoryId: p.category_id })

  const pickImage = async () => {
      try {
        const ImagePicker = await import('expo-image-picker')
        const { File, Directory, Paths } = await import('expo-file-system')
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!perm.granted) {
          Alert.alert('Izin dibutuhkan', 'Berikan izin akses galeri untuk memilih foto produk.')
          return
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.5,
          allowsEditing: true,
          aspect: [1, 1],
        })
        if (res.canceled || !res.assets?.[0]) return
        const asset = res.assets[0]
        const fileName = asset.uri.split('/').pop() || `pos_${Date.now()}.jpg`
        const dir = new Directory(Paths.document, 'pos_images')
        if (!dir.exists) dir.create()
        const dest = new File(dir, fileName)
        const source = new File(asset.uri)
        source.copy(dest)
        setEditing((prev) => (prev ? { ...prev, imageUri: dest.uri } : prev))
      } catch (e) {
        Alert.alert('Gagal', e instanceof Error ? e.message : String(e))
      }
    }

  const save = () => {
    if (!editing) return
    const stockVal = editing.stock.trim() === '' ? null : Number(editing.stock.replace(/\D/g, ''))
    try {
      if (editing.id === null) {
        addProduct(editing.name, Number(editing.price.replace(/\D/g, '')), editing.categoryId, stockVal, editing.imageUri)
      } else {
        updateProduct(editing.id, editing.name, Number(editing.price.replace(/\D/g, '')), editing.categoryId, stockVal, editing.imageUri)
      }
      setEditing(null)
      refresh()
    } catch (e) {
      Alert.alert('Gagal simpan', e instanceof Error ? e.message : String(e))
    }
  }

  const confirmDelete = (p: ProductRow) => {
    Alert.alert(
      'Hapus produk?',
      `"${p.name}" akan disembunyikan dari kasir. Riwayat transaksi tetap aman.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus', style: 'destructive',
          onPress: () => { deleteProduct(p.id); refresh() },
        },
      ]
    )
  }

  const saveCategory = () => {
    try {
      addCategory(newCat)
      setCategories(listCategories())
      setNewCat('')
      setShowNewCat(false)
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Button mode="contained" icon="plus" onPress={openAdd} style={styles.addBtn} contentStyle={{ height: 48 }}>
          Tambah Produk Baru
        </Button>

        {!showNewCat ? (
          <Pressable onPress={() => setShowNewCat(true)}>
            <Text style={styles.catLink}>+ Tambah kategori baru</Text>
          </Pressable>
        ) : (
          <View style={styles.catRow}>
            <TextInput
              value={newCat}
              onChangeText={setNewCat}
              placeholder="Nama kategori (contoh: Snack)"
              style={{ flex: 1, backgroundColor: colors.surface }}
              dense
            />
            <Button mode="contained" onPress={saveCategory} compact style={{ marginLeft: 8 }}>
              Simpan
            </Button>
          </View>
        )}

        <Text style={styles.sectionTitle}>Daftar Produk ({products.length})</Text>

        {products.map((p) => (
          <Surface key={p.id} style={[styles.card, !p.is_active && styles.cardInactive]} elevation={0}>
            <Pressable style={{ flex: 1 }} onPress={() => openEdit(p)}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.price}>{rupiah(p.price)}{p.category_name ? `  •  ${p.category_name}` : ''}</Text>
              {p.stock !== null && (
                <Text style={[styles.stockTxt, p.stock <= 5 && styles.stockLow]}>
                  {p.stock <= 0 ? 'Stok habis' : `Stok: ${p.stock}`}
                </Text>
              )}
              {!p.is_active && <Text style={styles.inactive}>Nonaktif</Text>}
            </Pressable>
            <Switch
              value={!!p.is_active}
              onValueChange={(v) => { toggleProductActive(p.id, v); refresh() }}
              trackColor={{ true: colors.green }}
            />
            <Pressable onPress={() => confirmDelete(p)} hitSlop={12}>
              <Text style={styles.del}>Hapus</Text>
            </Pressable>
          </Surface>
        ))}
      </ScrollView>

      <Modal visible={!!editing} onDismiss={() => setEditing(null)} contentContainerStyle={styles.modal}>
        {editing ? (
          <>
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editing.id === null ? 'Tambah Produk' : 'Edit Produk'}
            </Text>

            <Text style={styles.label}>Nama Produk *</Text>
            <TextInput value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })}
              style={{ backgroundColor: colors.surface }} placeholder="contoh: Kopi Susu Gula Aren"
              placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Harga Jual * (per item, dalam rupiah)</Text>
            <Surface style={[styles.priceHintBox, { backgroundColor: colors.chipBg }]} elevation={0}>
              <Text style={styles.priceHintTxt}>Contoh: 15000 = Rp 15.000</Text>
            </Surface>
            <TextInput value={editing.price}
              onChangeText={(v) => setEditing({ ...editing, price: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
              left={<TextInput.Affix text="Rp " />}
              style={{ backgroundColor: colors.surface, fontSize: 18, fontWeight: '800' }}
              placeholder="0" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Stok — jumlah barang tersedia</Text>
            <TextInput value={editing.stock}
              onChangeText={(v) => setEditing({ ...editing, stock: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
              left={<TextInput.Affix text="Stok: " />}
              style={{ backgroundColor: colors.surface }} placeholder="Kosongkan jika tidak perlu dilacak"
              placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Foto Produk (opsional)</Text>
            <Pressable onPress={pickImage} style={styles.imgPicker}>
              {editing.imageUri ? (
                <>
                  <Image source={{ uri: editing.imageUri }} style={styles.imgPreview} />
                  <Pressable onPress={() => setEditing({ ...editing, imageUri: null })} hitSlop={10}>
                    <Text style={styles.imgRemove}>hapus foto</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.imgPickerIcon}>Foto</Text>
                  <Text style={styles.imgPickerTxt}>Pilih dari Galeri</Text>
                  <Text style={styles.imgPickerSub}>Foto muncul di layar kasir biar makin menarik</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.label}>Kategori</Text>
            <View style={styles.chips}>
              <Pressable onPress={() => setEditing({ ...editing, categoryId: null })}
                style={[styles.chip, editing.categoryId === null && styles.chipActive]}>
                <Text style={[styles.chipTxt, editing.categoryId === null && styles.chipTxtActive]}>Tanpa kategori</Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable key={c.id} onPress={() => setEditing({ ...editing, categoryId: c.id })}
                  style={[styles.chip, editing.categoryId === c.id && styles.chipActive]}>
                  <Text style={[styles.chipTxt, editing.categoryId === c.id && styles.chipTxtActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>

            <Button mode="contained" onPress={save} contentStyle={{ height: 52 }} style={{ marginTop: 20 }}>
              Simpan Produk
            </Button>
            <Button mode="text" onPress={() => setEditing(null)} textColor={colors.textMuted}>
              Batal
            </Button>
          </>
        ) : null}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 14 },
  addBtn: { marginBottom: 12 },
  catLink: { color: colors.blue, fontWeight: '600', fontSize: 13, marginBottom: 16, marginLeft: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 8,
  },
  cardInactive: { opacity: 0.55 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  price: { fontSize: 13, color: colors.greenDark, marginTop: 2 },
  inactive: { fontSize: 11, color: colors.error, marginTop: 2 },
  stockTxt: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stockLow: { color: colors.terra, fontWeight: '700' },
  del: { fontSize: 13, color: colors.error, fontWeight: '700' },
  modal: { backgroundColor: colors.surface, margin: 20, borderRadius: 20, padding: 22 },
  modalTitle: { fontWeight: '800', color: colors.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 6 },
  priceHintBox: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 6, alignSelf: 'flex-start' },
  priceHintTxt: { fontSize: 11.5, color: colors.greenDark, fontWeight: '700' },
  imgPicker: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 14,
    alignItems: 'center', paddingVertical: 18, marginTop: 2, backgroundColor: colors.chipBg,
  },
  imgPickerIcon: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  imgPickerTxt: { color: colors.greenDark, fontWeight: '800', marginTop: 6, fontSize: 14 },
  imgPickerSub: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  imgPreview: { width: 110, height: 110, borderRadius: 12 },
  imgRemove: { color: colors.error, fontWeight: '700', fontSize: 12, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.chipBg, borderColor: colors.green },
  chipTxt: { fontSize: 13, color: colors.text },
  chipTxtActive: { color: colors.greenDark, fontWeight: '700' },
})
