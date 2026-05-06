'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"assets/AssetManifest.bin": "9c726038e671d02937d0591cfe49200e",
"assets/AssetManifest.bin.json": "cf0ab0edb0d57920d5f289cbe424f6a0",
"assets/assets/animations/animations.json": "69b416ee340354747a6cb990960ed4ce",
"assets/assets/game_data.json": "6418759254a9c1f347193c9c108db68d",
"assets/assets/media/ButtonRed-Sheet.png": "87978690f2bbc7cd35a766d8b0d20250",
"assets/assets/media/Extending%2520Padlock%2520-%2520GOLD%2520-%2520Spritesheet.png": "8a9a046d7042a4296dcce3d3cde4f8de",
"assets/assets/media/Key%25208%2520-%2520GOLD%2520-%2520Spritesheet.png": "69f0730d20a52c4e6ca07f51c9a7ecf6",
"assets/assets/media/owlet_amarillo.png": "30e1c219807a31870353d640a1c61a52",
"assets/assets/media/owlet_azul.png": "0f53be8ccb51e338eea52b999b7932c5",
"assets/assets/media/owlet_base.png": "e375bf91713845106d3ef8b0d7858531",
"assets/assets/media/owlet_marron.png": "d3f35694d7e9a6e67cb7dd1e14f38645",
"assets/assets/media/owlet_morado.png": "0d83a2e631f7ee0597a4439c9dbbcb6e",
"assets/assets/media/owlet_naranja.png": "2ba8f5cd94e609ca78b29cc5e8cbcf63",
"assets/assets/media/owlet_rojo.png": "bdd314721d171f72cbc8f312f20b1144",
"assets/assets/media/owlet_verde.png": "4f6d6d0821a668e485124c1db91f9681",
"assets/assets/media/sunken_blocky.png": "d311fbfe09c5dc3d1ccc77985229b8c4",
"assets/assets/media/Triangle%2520Padlock%2520-%2520GOLD%2520-%2520Spritesheet.png": "218b39bbd4d7308c4cc0bba131f853ad",
"assets/assets/paths/level_000_paths.json": "fb36aa512bdadb7d7842b45840a2a968",
"assets/assets/paths/level_001_paths.json": "9b5ac981a61d112baa13a2e2c17a5543",
"assets/assets/tilemaps/level_000_layer_000.json": "164baa1049189fe6c14f6c7cb9dfc896",
"assets/assets/tilemaps/level_000_layer_001.json": "21b80bc883490fcbe400c6ca481d5a88",
"assets/assets/tilemaps/level_000_layer_002.json": "e0fd4a4b0524e9cca237a2c4aa0aa830",
"assets/assets/tilemaps/level_000_layer_003.json": "7b6510862398e7277ea0592b6ae77872",
"assets/assets/tilemaps/level_001_layer_000.json": "23e527f8241dda0a118eb9e95079bbf1",
"assets/assets/tilemaps/level_001_layer_001.json": "5bc4fa495af7bf43d5c5ed31fd6cee45",
"assets/assets/tilemaps/level_001_layer_002.json": "9f4a125ce5c483c934ea4561e88f8da8",
"assets/assets/tilemaps/level_001_layer_003.json": "d44bb5716281ed8246031a21c50d3684",
"assets/assets/tilemaps/level_001_layer_004.json": "347409c993f680bf0794b1ea9e0a7032",
"assets/assets/zones/level_000_zones.json": "f71b84dfc8aced8ddc544a811a5a6935",
"assets/assets/zones/level_001_zones.json": "07117c98c96418e16a037209d64146dc",
"assets/FontManifest.json": "dc3d03800ccca4601324923c0b1d6d57",
"assets/fonts/MaterialIcons-Regular.otf": "c0ad29d56cfe3890223c02da3c6e0448",
"assets/NOTICES": "4518c7c5245475e66609298409bcc7f9",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "33b7d9392238c04c131b6ce224e13711",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/shaders/stretch_effect.frag": "40d68efbbf360632f614c731219e95f0",
"canvaskit/canvaskit.js": "8331fe38e66b3a898c4f37648aaf7ee2",
"canvaskit/canvaskit.js.symbols": "a3c9f77715b642d0437d9c275caba91e",
"canvaskit/canvaskit.wasm": "9b6a7830bf26959b200594729d73538e",
"canvaskit/chromium/canvaskit.js": "a80c765aaa8af8645c9fb1aae53f9abf",
"canvaskit/chromium/canvaskit.js.symbols": "e2d09f0e434bc118bf67dae526737d07",
"canvaskit/chromium/canvaskit.wasm": "a726e3f75a84fcdf495a15817c63a35d",
"canvaskit/skwasm.js": "8060d46e9a4901ca9991edd3a26be4f0",
"canvaskit/skwasm.js.symbols": "3a4aadf4e8141f284bd524976b1d6bdc",
"canvaskit/skwasm.wasm": "7e5f3afdd3b0747a1fd4517cea239898",
"canvaskit/skwasm_heavy.js": "740d43a6b8240ef9e23eed8c48840da4",
"canvaskit/skwasm_heavy.js.symbols": "0755b4fb399918388d71b59ad390b055",
"canvaskit/skwasm_heavy.wasm": "b0be7910760d205ea4e011458df6ee01",
"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"flutter.js": "24bc71911b75b5f8135c949e27a2984e",
"flutter_bootstrap.js": "bbd9a8ed80dc5c5c7a658dfb1e36998a",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"icons/Icon-maskable-192.png": "c457ef57daa1d16f64b27b786ec2ea3c",
"icons/Icon-maskable-512.png": "301a7604d45b3e739efc881eb04896ea",
"index.html": "07134f538a456bcb34a2d76732f0b86d",
"/": "07134f538a456bcb34a2d76732f0b86d",
"main.dart.js": "ed6ec550fb44dee5faeb2e7829f0ae54",
"manifest.json": "0e1a3a343aae6d7f2138d36b43b0eb27",
"version.json": "287f8110cb7534ebd0c81680606d62fb"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
