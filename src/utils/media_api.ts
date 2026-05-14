import { r } from "~/utils"
import type {
  MediaItem,
  AlbumInfo,
  MediaConfig,
  MediaScanPath,
  MediaScanProgress,
  MediaListQuery,
  MediaType,
} from "~/types"
import type { Resp } from "~/types"

// ==================== 公开API ====================

/** 获取媒体列表 */
export const getMediaList = (query: MediaListQuery) =>
  r.get("/fs/media/list", { params: query }) as Promise<
    Resp<{ content: MediaItem[]; total: number }>
  >

/** 获取媒体详情 */
export const getMediaItem = (id: number) =>
  r.get(`/fs/media/item/${id}`) as Promise<Resp<MediaItem>>

/** 获取专辑列表 */
export const getAlbumList = (params: {
  page?: number
  page_size?: number
  keyword?: string
  scan_path_id?: number
}) =>
  r.get("/fs/media/albums", { params }) as Promise<
    Resp<{ content: AlbumInfo[]; total: number }>
  >

/** 获取专辑曲目 */
export const getAlbumTracks = (albumName: string, albumArtist: string) =>
  r.get("/fs/media/album", {
    params: { album_name: albumName, album_artist: albumArtist },
  }) as Promise<Resp<MediaItem[]>>

/** 获取文件夹列表（目录浏览模式） */
export const getMediaFolders = (mediaType: MediaType) =>
  r.get("/fs/media/folders", { params: { media_type: mediaType } }) as Promise<
    Resp<string[]>
  >

/** 获取扫描路径列表（公开，用于前端筛选） */
export const getMediaScanPaths = (mediaType?: MediaType) =>
  r.get("/fs/media/scan_paths", {
    params: mediaType ? { media_type: mediaType } : {},
  }) as Promise<Resp<MediaScanPath[]>>

// ==================== 管理API ====================

/** 获取所有媒体库配置 */
export const adminGetMediaConfigs = () =>
  r.get("/admin/media/config/list") as Promise<Resp<MediaConfig[]>>

/** 保存媒体库配置 */
export const adminSaveMediaConfig = (cfg: Partial<MediaConfig>) =>
  r.post("/admin/media/config/save", cfg) as Promise<Resp<null>>

/** 获取扫描路径列表（管理） */
export const adminListMediaScanPaths = (mediaType?: MediaType) =>
  r.get("/admin/media/scan_paths", {
    params: mediaType ? { media_type: mediaType } : {},
  }) as Promise<Resp<MediaScanPath[]>>

/** 创建扫描路径 */
export const adminCreateMediaScanPath = (sp: Partial<MediaScanPath>) =>
  r.post("/admin/media/scan_paths/create", sp) as Promise<Resp<MediaScanPath>>

/** 更新扫描路径 */
export const adminUpdateMediaScanPath = (
  sp: Partial<MediaScanPath> & { id: number },
) => r.post("/admin/media/scan_paths/update", sp) as Promise<Resp<null>>

/** 删除扫描路径 */
export const adminDeleteMediaScanPath = (id: number) =>
  r.post("/admin/media/scan_paths/delete", null, {
    params: { id },
  }) as Promise<Resp<null>>

/** 清空扫描路径数据 */
export const adminClearMediaScanPathDB = (id: number) =>
  r.post("/admin/media/scan_paths/clear", null, {
    params: { id },
  }) as Promise<Resp<null>>

/** 后台获取媒体条目列表 */
export const adminGetMediaItems = (params: {
  media_type?: MediaType
  scan_path_id?: number
  page?: number
  page_size?: number
  keyword?: string
  order_by?: string
  order_dir?: string
}) =>
  r.get("/admin/media/items", { params }) as Promise<
    Resp<{ content: MediaItem[]; total: number }>
  >

/** 更新媒体条目 */
export const adminUpdateMediaItem = (
  item: Partial<MediaItem> & { id: number },
) => r.post("/admin/media/items/update", item) as Promise<Resp<null>>

/** 删除媒体条目 */
export const adminDeleteMediaItem = (id: number) =>
  r.post("/admin/media/items/delete", null, {
    params: { id },
  }) as Promise<Resp<null>>

/** 开始扫描（可指定单个扫描路径） */
export const adminStartMediaScan = (
  mediaType: MediaType,
  scanPathId?: number,
) =>
  r.post("/admin/media/scan/start", {
    media_type: mediaType,
    scan_path_id: scanPathId ?? 0,
  }) as Promise<Resp<null>>

/** 获取扫描进度 */
export const adminGetMediaScanProgress = (mediaType: MediaType) =>
  r.get("/admin/media/scan/progress", {
    params: { media_type: mediaType },
  }) as Promise<Resp<MediaScanProgress>>

/** 开始刮削 */
export const adminStartMediaScrape = (mediaType: MediaType, itemId?: number) =>
  r.post("/admin/media/scrape/start", {
    media_type: mediaType,
    item_id: itemId ?? 0,
  }) as Promise<Resp<null>>

/** 清空媒体数据库（整个类型） */
export const adminClearMediaDB = (mediaType: MediaType) =>
  r.post("/admin/media/clear", null, {
    params: { media_type: mediaType },
  }) as Promise<Resp<null>>

/** 清空刮削数据（保留扫描记录，只清空刮削结果字段）
 *  mediaType 为空表示清空所有类型
 */
export const adminClearMediaScrape = (mediaType?: MediaType) =>
  r.post("/admin/media/clear_scrape", null, {
    params: mediaType ? { media_type: mediaType } : {},
  }) as Promise<Resp<{ affected: number }>>

/** 删除已失效的媒体条目（对应文件已不存在）
 *  mediaType 为空表示扫描所有类型
 */
export const adminDeleteInvalidMedia = (mediaType?: MediaType) =>
  r.post("/admin/media/delete_invalid", null, {
    params: mediaType ? { media_type: mediaType } : {},
  }) as Promise<Resp<{ checked: number; deleted: number }>>

/** 导出媒体数据
 *  - mediaType 为空 + scanPathId 为空 => 全部导出
 *  - 仅 mediaType => 导出指定类型
 *  - 仅 scanPathId => 导出单个扫描路径
 *  返回 Blob，供前端触发浏览器下载
 */
export const adminExportMediaDB = (
  mediaType?: MediaType,
  scanPathId?: number,
) => {
  const params: Record<string, any> = {}
  if (mediaType) params.media_type = mediaType
  if (scanPathId) params.scan_path_id = scanPathId
  return r.get("/admin/media/export", {
    params,
    responseType: "blob",
  }) as unknown as Promise<Blob>
}

/** 导入媒体数据（multipart/form-data）
 *  scanPathId 可选：传入则把导入条目的 scan_path_id 全部覆盖为该值
 *  （用于"导入到指定扫描路径"场景）
 */
export const adminImportMediaDB = (file: File, scanPathId?: number) => {
  const form = new FormData()
  form.append("file", file)
  const params: Record<string, any> = {}
  if (scanPathId) params.scan_path_id = scanPathId
  return r.post("/admin/media/import", form, {
    params,
    headers: { "Content-Type": "multipart/form-data" },
  }) as Promise<
    Resp<{
      scan_paths_created: number
      scan_paths_updated: number
      items_created: number
      items_updated: number
    }>
  >
}
