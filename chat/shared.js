function loadScript(src) {
	var script = document.createElement('script');
	script.src = src;
	script.type = 'text/javascript';
	document.head.appendChild(script);
}
  
loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.js")
loadScript("https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js")
