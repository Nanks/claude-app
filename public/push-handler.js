self.addEventListener('push', function (event) {
  var data  = event.data ? event.data.json() : {}
  var title = data.title || 'Golf League'
  var body  = data.body  || ''
  var url   = data.url   || '/'
  var tag   = data.tag   || 'golf-league'

  event.waitUntil(
    self.registration.showNotification(title, {
      body:     body,
      icon:     '/android-chrome-192x192.png',
      badge:    '/favicon-32x32.png',
      tag:      tag,
      data:     { url: url },
      renotify: !!data.renotify,
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  var url = event.notification.data ? event.notification.data.url : '/'
  event.notification.close()

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clients) {
        var win = clients.find(function (c) { return 'focus' in c })
        if (win) {
          win.focus()
          win.navigate(url)
        } else {
          self.clients.openWindow(url)
        }
      })
  )
})
