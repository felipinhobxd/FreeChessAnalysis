// Marker library for Android ABIs that do not have a native Stockfish build.
// It is never loaded by the application. Its presence lets the Package Manager
// install the WebView app on devices that must use the WebAssembly fallback.
void movebymove_abi_compatibility_marker(void) {}
