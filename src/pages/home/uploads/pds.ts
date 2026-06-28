import { Upload, SetUpload } from "./types"
import { Resp } from "~/types"
import { r, pathBase, pathDir } from "~/utils"

type DirectUploadCompletionInfo = {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: unknown
}

type PdsDirectUploadInfo = {
  upload_url: string
  headers?: Record<string, string>
  method?: string
  complete?: DirectUploadCompletionInfo
}

export const PdsDirectUpload: Upload = async (
  uploadPath: string,
  file: File,
  setUpload: SetUpload,
  _asTask: boolean,
  overwrite: boolean,
  _rapid: boolean,
) => {
  const path = pathDir(uploadPath)

  const resp = (await r.post(
    "/fs/get_direct_upload_info",
    {
      path,
      file_name: file.name,
      file_size: file.size,
      tool: "PdsDirect",
    },
    {
      headers: {
        "File-Path": encodeURIComponent(uploadPath),
        Overwrite: overwrite,
      },
    },
  )) as Resp<PdsDirectUploadInfo | null>

  if (resp.code !== 200) {
    throw new Error(resp.message)
  }

  const uploadInfo = resp.data

  if (!uploadInfo?.upload_url) {
    throw new Error("PDS Direct Upload not supported")
  }

  await uploadSingle(
    file,
    uploadInfo.upload_url,
    uploadInfo.method || "PUT",
    uploadInfo.headers,
    setUpload,
  )

  await completeDirectUpload(uploadInfo.complete, uploadPath, setUpload)
  return undefined
}

function getHeaderEntries(headers?: Record<string, string>) {
  return Object.entries(headers ?? {}).filter(([, value]) => value !== "")
}

function shouldSuppressContentType(headers?: Record<string, string>) {
  return Object.entries(headers ?? {}).some(
    ([key, value]) => key.toLowerCase() === "content-type" && value === "",
  )
}

function getRequestBody(blob: Blob, suppressContentType: boolean): Blob {
  if (!suppressContentType || blob.type === "") {
    return blob
  }
  return blob.slice(0, blob.size, "")
}

async function uploadSingle(
  file: File,
  uploadURL: string,
  method: string,
  headers?: Record<string, string>,
  setUpload?: SetUpload,
): Promise<undefined> {
  const xhr = new XMLHttpRequest()
  const calcSpeed = createSpeedCalculator()
  const suppressContentType = shouldSuppressContentType(headers)

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && setUpload) {
        const progress = (e.loaded / e.total) * 100
        setUpload("progress", progress)
        calcSpeed(e.loaded, setUpload)
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(undefined)
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"))
    })

    xhr.open(method, uploadURL)

    getHeaderEntries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.send(getRequestBody(file, suppressContentType))
  })
}

function createSpeedCalculator(throttleMs = 500) {
  let lastLoaded = 0
  let lastTime = Date.now()

  return (loaded: number, setUpload?: SetUpload) => {
    const now = Date.now()
    const timeDiff = (now - lastTime) / 1000

    if (timeDiff >= throttleMs / 1000) {
      const speed = (loaded - lastLoaded) / timeDiff
      setUpload?.("speed", speed)
      lastLoaded = loaded
      lastTime = now
    }
  }
}

async function completeDirectUpload(
  complete?: DirectUploadCompletionInfo,
  uploadPath?: string,
  setUpload?: SetUpload,
): Promise<void> {
  if (!complete) {
    return
  }
  if (!complete.url) {
    throw new Error("Direct upload completion URL is missing")
  }

  setUpload?.("status", "backending")

  const headers = new Headers()
  getHeaderEntries(complete.headers).forEach(([key, value]) => {
    headers.set(key, value)
  })
  if (uploadPath && !headers.has("File-Path")) {
    headers.set("File-Path", encodeURIComponent(uploadPath))
  }
  if (!headers.has("Authorization")) {
    const token = localStorage.getItem("token")
    if (token) {
      headers.set("Authorization", token)
    }
  }

  let body: BodyInit | undefined
  const completeBody = normalizeCompleteBody(complete.body, uploadPath)
  if (completeBody !== undefined && completeBody !== null) {
    if (typeof completeBody === "string") {
      body = completeBody
    } else {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
      }
      body = JSON.stringify(completeBody)
    }
  }

  const resp = await fetch(complete.url, {
    method: complete.method || "POST",
    headers,
    body,
  })
  const text = await resp.text()
  let data: Resp<unknown> | undefined
  try {
    data = text ? (JSON.parse(text) as Resp<unknown>) : undefined
  } catch {
    data = undefined
  }
  if (!resp.ok) {
    throw new Error(data?.message || `Complete upload failed: ${resp.status}`)
  }
  if (data && data.code !== 200) {
    throw new Error(data.message || "Complete upload failed")
  }
}

function normalizeCompleteBody(body: unknown, uploadPath?: string): unknown {
  if (!uploadPath || typeof body !== "object" || body === null) {
    return body
  }
  if (Array.isArray(body)) {
    return body
  }
  return {
    ...(body as Record<string, unknown>),
    path: pathDir(uploadPath),
    file_name: pathBase(uploadPath),
  }
}
