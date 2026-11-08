import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { uid } from './id';
import type { Attachment } from './types';

/** Tamanho máximo do lado maior da foto salva (bom para leitura e OCR, leve para o backup). */
const MAX_SIDE = 2000;

function attachmentsDir(): Directory {
  const dir = new Directory(Paths.document, 'attachments');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export type PhotoSource = 'camera' | 'library';

/**
 * Abre a câmera (ou a galeria), reduz a foto e copia para a pasta do app,
 * para que ela continue disponível offline.
 */
export async function pickPhoto(source: PhotoSource): Promise<Attachment | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Permita o acesso à câmera nos Ajustes do aparelho.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;

  const asset = res.assets[0];
  const scale = Math.min(1, MAX_SIDE / Math.max(asset.width || MAX_SIDE, asset.height || MAX_SIDE));
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (scale < 1) ctx.resize({ width: Math.round(asset.width * scale) });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });

  const id = uid();
  let localUri = saved.uri;
  if (Platform.OS !== 'web') {
    const dest = new File(attachmentsDir(), `${id}.jpg`);
    new File(saved.uri).copySync(dest);
    localUri = dest.uri;
  }
  return { id, localUri, width: saved.width, height: saved.height, createdAt: Date.now() };
}

/** Lê a foto em base64 (JPEG) para enviar à IA de leitura de manuscritos. */
export async function readAsBase64(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ base64: true, compress: 0.8, format: SaveFormat.JPEG });
  if (!out.base64) throw new Error('Não foi possível ler a imagem.');
  return out.base64;
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/** Baixa um anexo vindo de outro aparelho para a pasta local. */
export async function downloadTo(url: string, attId: string): Promise<string> {
  const dest = new File(attachmentsDir(), `${attId}.jpg`);
  if (dest.exists) return dest.uri;
  const file = await File.downloadFileAsync(url, dest);
  return file.uri;
}

export function deleteLocal(uri?: string) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // arquivo já removido
  }
}

export function localExists(uri?: string): boolean {
  if (!uri) return false;
  if (Platform.OS === 'web') return true;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
