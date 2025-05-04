
# todo - feb 2025

	- have a startup message / some debugging

	- introduce an overlay mode where the puppet is transparent over the web page in a corner as if it was a helper for that page
	- icons could just use emoji

	- puppet gaze focus on player is too frequent, and eyes pop a bit too much
	- puppet body physical animations are still turned off, turn back on

	- mobile improvement
		- cannot use built in voice out due to a lack of timing information - any way to estimate tts out duration?
		- tts out could compute visemes from phonemes to eliminate need for whisper (which crashes mobile out)
		- mobile audio echo cancellation seems to be totally broken
		- mobile llm is too heavy - crashes

## Refining orbital-sys

The orbital-sys component itself could support more direct chaining, where systems could be wired to each other.
At the moment the output of any system goes to sys as a whole.
The chain for each message should be built from specific observers.
For example we always want to unpack arrays and that is always an early event observer.
One approach is to leave publishing alone but to refine subscribing:
```
	sys({
		resolve: {
			tick: {}=>()
		}
	})
```

Another option is to directly wire systems to each other, this would reduce the name space collisions also in entity component naming.
