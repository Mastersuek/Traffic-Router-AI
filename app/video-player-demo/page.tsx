"use client"

import { useState } from 'react'
import { StreamingVideoPlayer } from '@/components/ui/streaming-video-player'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function VideoPlayerDemo() {
  const [videoId, setVideoId] = useState('')
  const [currentVideoId, setCurrentVideoId] = useState('')
  const [quality, setQuality] = useState<'480p' | '640p' | '1024p'>('640p')
  const [progress, setProgress] = useState(0)
  const [cacheStats, setCacheStats] = useState<any>(null)

  const handleLoadVideo = () => {
    if (videoId.trim()) {
      // Извлекаем ID из YouTube URL если нужно
      const ytId = extractYouTubeId(videoId)
      if (ytId) {
        setCurrentVideoId(ytId)
      }
    }
  }

  const extractYouTubeId = (url: string): string => {
    // Если это уже ID
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
      return url
    }
    
    // Извлекаем из различных форматов YouTube URL
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }
    
    return url // Возвращаем как есть, если не смогли извлечь
  }

  const loadCacheStats = async () => {
    try {
      const response = await fetch('http://localhost:13083/api/stats')
      if (response.ok) {
        const stats = await response.json()
        setCacheStats(stats)
      }
    } catch (error) {
      console.error('Failed to load cache stats:', error)
    }
  }

  const handleCacheVideo = async () => {
    if (!currentVideoId) return
    
    try {
      const response = await fetch('http://localhost:13083/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: currentVideoId,
          qualities: ['480p', '640p', '1024p'],
          priority: 2
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        alert(`Видео добавлено в очередь кеширования. Позиция: ${result.queuePosition}`)
      }
    } catch (error) {
      console.error('Failed to cache video:', error)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🎬 YouTube Кешированный Плеер</h1>
        <p className="text-gray-600">
          Демонстрация потокового видеоплеера с кешированием и адаптивным качеством
        </p>
      </div>

      {/* Форма загрузки */}
      <Card>
        <CardHeader>
          <CardTitle>Загрузить видео</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Введите YouTube URL или Video ID..."
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleLoadVideo} disabled={!videoId.trim()}>
              Загрузить
            </Button>
          </div>
          
          <div className="flex gap-2 text-sm text-gray-600">
            <span>Примеры:</span>
            <code className="bg-gray-100 px-2 py-1 rounded">dQw4w9WgXcQ</code>
            <code className="bg-gray-100 px-2 py-1 rounded">https://youtu.be/dQw4w9WgXcQ</code>
          </div>
        </CardContent>
      </Card>

      {/* Видеоплеер */}
      {currentVideoId && (
        <Card>
          <CardContent className="p-0">
            <StreamingVideoPlayer
              videoId={currentVideoId}
              title={`Video ID: ${currentVideoId}`}
              initialQuality={quality}
              onQualityChange={(newQuality) => setQuality(newQuality as any)}
              onProgress={setProgress}
              className="aspect-video max-h-[600px]"
            />
          </CardContent>
        </Card>
      )}

      {/* Управление кешем */}
      {currentVideoId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Управление кешем</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Button onClick={handleCacheVideo} variant="outline">
                  📥 Кешировать во всех качествах
                </Button>
                <Button onClick={loadCacheStats} variant="outline">
                  📊 Обновить статистику кеша
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">Текущее качество:</h4>
                <Badge variant="secondary">{quality}</Badge>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">Прогресс воспроизведения:</h4>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{progress.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Статистика кеша */}
          <Card>
            <CardHeader>
              <CardTitle>Статистика кеша</CardTitle>
            </CardHeader>
            <CardContent>
              {cacheStats ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Всего видео:</div>
                      <div className="text-xl font-bold">{cacheStats.totalVideos}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Размер кеша:</div>
                      <div className="text-xl font-bold">{cacheStats.totalSizeGB} GB</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Активные загрузки:</div>
                      <div className="text-xl font-bold">{cacheStats.activeDownloads}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">В очереди:</div>
                      <div className="text-xl font-bold">{cacheStats.queuedDownloads}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">По качествам:</h4>
                    <div className="flex gap-2">
                      {Object.entries(cacheStats.qualityStats || {}).map(([quality, count]) => (
                        <Badge key={quality} variant="outline">
                          {quality}: {count as number}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    Максимальный размер кеша: {cacheStats.config?.maxSizeGB} GB
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  Нажмите "Обновить статистику" для загрузки данных
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Инструкции */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Инструкции</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Возможности плеера:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Адаптивное качество (480p, 640p, 1024p)</li>
                <li>• Умное кеширование с автоочисткой</li>
                <li>• Потоковое воспроизведение</li>
                <li>• Полноэкранный режим</li>
                <li>• Статистика буферизации</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Управление:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Клик - воспроизведение/пауза</li>
                <li>• Двойной клик - полный экран</li>
                <li>• Колесо мыши - громкость</li>
                <li>• Пробел - воспроизведение/пауза</li>
                <li>• ←→ - перемотка на 10 секунд</li>
              </ul>
            </div>
          </div>
          
          <div className="pt-3 border-t text-xs text-gray-500">
            💡 Видео автоматически кешируется при первом запросе. 
            Повторные просмотры загружаются мгновенно из локального кеша.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}