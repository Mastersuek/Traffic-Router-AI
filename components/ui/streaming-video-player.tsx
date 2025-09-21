"use client"

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings, 
  Download,
  SkipBack,
  SkipForward
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StreamingVideoPlayerProps {
  videoId: string
  title?: string
  autoplay?: boolean
  initialQuality?: '480p' | '640p' | '1024p'
  onQualityChange?: (quality: string) => void
  onProgress?: (progress: number) => void
  className?: string
}

interface VideoStats {
  buffered: number
  downloadSpeed: number
  droppedFrames: number
  quality: string
  bitrate: string
}

export function StreamingVideoPlayer({
  videoId,
  title,
  autoplay = false,
  initialQuality = '640p',
  onQualityChange,
  onProgress,
  className = ''
}: StreamingVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [quality, setQuality] = useState(initialQuality)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showControls, setShowControls] = useState(true)
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null)
  const [bufferHealth, setBufferHealth] = useState(0)
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const statsIntervalRef = useRef<NodeJS.Timeout>()
  
  const qualities = [
    { value: '480p', label: '480p (1MB/s)', bitrate: '1000k' },
    { value: '640p', label: '640p (1.5MB/s)', bitrate: '1500k' },
    { value: '1024p', label: '1024p (3MB/s)', bitrate: '3000k' }
  ]

  // Адаптивное качество на основе скорости соединения
  const detectOptimalQuality = useCallback(async () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      const downlink = connection.downlink // Mbit/s
      
      if (downlink < 2) return '480p'
      else if (downlink < 5) return '640p'
      else return '1024p'
    }
    
    // Fallback: тестовая загрузка небольшого фрагмента
    try {
      const start = Date.now()
      const response = await fetch(`http://localhost:13083/health`)
      const end = Date.now()
      const speed = 1000 / (end - start) // условная скорость
      
      if (speed < 100) return '480p'
      else if (speed < 300) return '640p'
      else return '1024p'
    } catch {
      return '640p' // по умолчанию
    }
  }, [videoId])

  // Загрузка видео с кешированием
  const loadVideo = useCallback(async (selectedQuality: string) => {
    if (!videoRef.current) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`http://localhost:13083/api/video/${videoId}/${selectedQuality}`)
      
      if (!response.ok) {
        const data = await response.json()
        if (response.status === 404) {
          // Видео не кешировано, добавляем в очередь
          await fetch('http://localhost:13083/api/cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              videoId, 
              qualities: [selectedQuality], 
              priority: 1 
            })
          })
          setError(`Видео кешируется... Ожидание: ~${data.estimatedWait || 5} минут`)
          return
        }
        throw new Error(data.error || 'Failed to load video')
      }
      
      // Проверяем, что ответ содержит видео
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('video/mp4')) {
        const data = await response.json()
        setError(data.message || 'Video is being cached')
        return
      }
      
      // Создаем URL для видео
      const videoBlob = await response.blob()
      const videoUrl = URL.createObjectURL(videoBlob)
      
      videoRef.current.src = videoUrl
      
      if (autoplay) {
        videoRef.current.play()
      }
      
    } catch (error) {
      console.error('Error loading video:', error)
      setError(error instanceof Error ? error.message : 'Failed to load video')
    } finally {
      setIsLoading(false)
    }
  }, [videoId, autoplay])

  // Обновление качества видео
  const changeQuality = useCallback(async (newQuality: string) => {
    if (newQuality === quality) return
    
    const currentTimeBackup = videoRef.current?.currentTime || 0
    const wasPlaying = isPlaying
    
    setQuality(newQuality as '480p' | '640p' | '1024p')
    onQualityChange?.(newQuality)
    
    await loadVideo(newQuality)
    
    // Восстанавливаем позицию и состояние воспроизведения
    if (videoRef.current) {
      videoRef.current.currentTime = currentTimeBackup
      if (wasPlaying) {
        videoRef.current.play()
      }
    }
  }, [quality, isPlaying, loadVideo, onQualityChange])

  // Статистика видео
  const updateVideoStats = useCallback(() => {
    if (!videoRef.current) return
    
    const video = videoRef.current
    const buffered = video.buffered.length > 0 ? 
      video.buffered.end(video.buffered.length - 1) / video.duration * 100 : 0
    
    // Примерная оценка скорости загрузки
    const downloadSpeed = buffered > bufferHealth ? 
      ((buffered - bufferHealth) * video.duration * 8) / 1000 : 0 // Kbit/s
    
    setVideoStats({
      buffered,
      downloadSpeed,
      droppedFrames: (video as any).webkitDroppedFrameCount || 0,
      quality,
      bitrate: qualities.find(q => q.value === quality)?.bitrate || '0k'
    })
    
    setBufferHealth(buffered)
  }, [quality, bufferHealth])

  // Управление воспроизведением
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
  }, [isPlaying])

  // Управление громкостью
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    
    if (isMuted) {
      videoRef.current.volume = volume
      setIsMuted(false)
    } else {
      videoRef.current.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const handleVolumeChange = useCallback((newVolume: number[]) => {
    if (!videoRef.current) return
    
    const vol = newVolume[0]
    setVolume(vol)
    videoRef.current.volume = vol
    setIsMuted(vol === 0)
  }, [])

  // Управление полноэкранным режимом
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Перемотка
  const seek = useCallback((time: number[]) => {
    if (!videoRef.current) return
    
    const seekTime = (time[0] / 100) * duration
    videoRef.current.currentTime = seekTime
    setCurrentTime(seekTime)
  }, [duration])

  const skipTime = useCallback((seconds: number) => {
    if (!videoRef.current) return
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }, [currentTime, duration])

  // Скрытие контролов
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }, [isPlaying])

  // Инициализация
  useEffect(() => {
    const initializePlayer = async () => {
      const optimalQuality = await detectOptimalQuality()
      const selectedQuality = initialQuality || optimalQuality
      
      setQuality(selectedQuality)
      await loadVideo(selectedQuality)
    }
    
    initializePlayer()
  }, [videoId, initialQuality, detectOptimalQuality, loadVideo])

  // События видео
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onProgress?.(video.currentTime / video.duration * 100)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleWaiting = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)

    const handleError = () => {
      setError('Ошибка воспроизведения видео')
      setIsLoading(false)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
    }
  }, [onProgress])

  // Статистика
  useEffect(() => {
    if (isPlaying) {
      statsIntervalRef.current = setInterval(updateVideoStats, 1000)
    } else {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
      }
    }

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
      }
    }
  }, [isPlaying, updateVideoStats])

  // Cleanup
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
      }
    }
  }, [])

  // Форматирование времени
  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden ${className}`}
      onMouseMove={resetControlsTimer}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Видео элемент */}
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />
      
      {/* Ошибка */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white">
            <div className="text-red-400 text-lg mb-2">⚠️ Ошибка</div>
            <div className="text-sm">{error}</div>
            {error.includes('кешируется') && (
              <Button 
                className="mt-4" 
                onClick={() => loadVideo(quality)}
                size="sm"
              >
                Проверить снова
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Загрузка */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
            <div className="text-sm">Загрузка...</div>
          </div>
        </div>
      )}
      
      {/* Контролы */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Прогресс */}
        <div className="mb-4">
          <Slider
            value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
            onValueChange={seek}
            className="w-full cursor-pointer"
            step={0.1}
          />
          {/* Буфер индикатор */}
          {videoStats && (
            <div className="mt-1">
              <div className="w-full bg-gray-700 h-1 rounded">
                <div 
                  className="h-1 bg-gray-500 rounded transition-all duration-300"
                  style={{ width: `${videoStats.buffered}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between text-white">
          {/* Левые контролы */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skipTime(-10)}
              className="text-white hover:bg-white/20"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlay}
              className="text-white hover:bg-white/20"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skipTime(10)}
              className="text-white hover:bg-white/20"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            
            {/* Громкость */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="text-white hover:bg-white/20"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              
              <div className="w-20">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  step={0.1}
                  className="cursor-pointer"
                />
              </div>
            </div>
            
            {/* Время */}
            <div className="text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          {/* Правые контролы */}
          <div className="flex items-center space-x-2">
            {/* Статистика */}
            {videoStats && (
              <div className="flex items-center space-x-2 text-xs">
                <Badge variant="secondary" className="bg-black/50">
                  {videoStats.quality}
                </Badge>
                <Badge variant="secondary" className="bg-black/50">
                  ↓ {videoStats.downloadSpeed.toFixed(0)} Kbps
                </Badge>
                <Badge variant="secondary" className="bg-black/50">
                  Buffer: {videoStats.buffered.toFixed(0)}%
                </Badge>
              </div>
            )}
            
            {/* Качество */}
            <Select value={quality} onValueChange={changeQuality}>
              <SelectTrigger className="w-20 h-8 text-xs bg-black/50 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualities.map(q => (
                  <SelectItem key={q.value} value={q.value}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Настройки */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              <Settings className="w-4 h-4" />
            </Button>
            
            {/* Полный экран */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Заголовок */}
      {title && (
        <div 
          className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <h3 className="text-white text-lg font-medium truncate">{title}</h3>
        </div>
      )}
    </div>
  )
}