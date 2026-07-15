## Objective
- Implementar pipelines de Downscaling, Rescaling y Cleaning para imágenes y videos

## Completed
- **Backend (execution.py)**: Agregados campos `mode`, `target_width`, `target_height`
- **Backend (upscalers.py)**:
  - Endpoint `/run` actualizado con `mode` param y soporte `exec_id` (re-run)
  - Lógica de cola (queue) implementada - solo 1 ejecución running a la vez
  - Pipeline `_run_pipeline` dispatchea según `mode`: clean/rescale/downscale/upscale
  - Funciones nuevas: `_run_clean()`, `_run_downscale()`, `_run_rescale()`
- **Frontend (ScaleSelectionView.tsx)**: Desbloqueados todos los modos (downscale/rescale/clean/folde
- **Frontend (UpscaleView.tsx)**: Prop `mode`, params `target_width/height` para rescale
- **Frontend (UpscaleSidebar.tsx)**: 
  - Prop `mode`, campos de rescale (width/height), clean (noise_strength)
  - Botón face-enhance oculto en modo clean
- **Frontend (App.tsx)**: Rutas dinámicas `mode-type` (ej: `downscale-image`, `clean-video`)
- **Frontend (index.ts)**: Export `ScaleMode` type

## Pending
- **Folder/Batch processing**: No implementado (requiere procesamiento por lotes)
- Tests: verificar funcionamiento con archivos reales

## Pipelines status
| Tipo | Modo | Status |
|------|------|--------|
| Imagen | Upscaling | ✅ |
| Imagen | Downscaling | ✅ (ffmpeg scale) |
| Imagen | Rescaling | ✅ (ffmpeg scale W:H) |
| Imagen | Cleaning | ✅ (hqdn3d filter) |
| Video | Upscaling | ✅ |
| Video | Downscaling | ✅ (frame-based) |
| Video | Rescaling | ⏳ (similar a downscale) |
| Video | Cleaning | ✅ (frame-based hqdn3d) |
| Carpeta | Todos | ⏳