// Schreibt Sprachclips mit der Spracherkennung von macOS ab (auf dem Gerät, de-DE) und gibt "Datei<TAB>Text" aus.
// Prüft, ob ElevenLabs den Satz richtig gesprochen und keine Regieanweisung mitgelesen hat. Kann MP3, aber kein AAC.
//
// macOS verlangt für die Spracherkennung ein App-Paket mit Nutzungsbeschreibung und eingeschaltetes Diktieren
// (Systemeinstellungen → Tastatur → Diktieren). Bauen und starten, siehe docs/AUDIO.md:
//   scripts/audio/build-transcribe.sh
//   open -W -n --stdout /tmp/stt.txt /tmp/Transcribe.app --args datei1.mp3 datei2.mp3
import Foundation
import Speech

let files = Array(CommandLine.arguments.dropFirst())
let sem = DispatchSemaphore(value: 0)
var status = SFSpeechRecognizerAuthorizationStatus.notDetermined
SFSpeechRecognizer.requestAuthorization { s in status = s; sem.signal() }
sem.wait()
guard status == .authorized else { print("Keine Berechtigung für die Spracherkennung (\(status.rawValue))"); exit(2) }
guard let rec = SFSpeechRecognizer(locale: Locale(identifier: "de-DE")), rec.supportsOnDeviceRecognition else {
  print("Keine Spracherkennung für Deutsch auf diesem Gerät")
  exit(3)
}
for f in files {
  let req = SFSpeechURLRecognitionRequest(url: URL(fileURLWithPath: f))
  req.requiresOnDeviceRecognition = true
  req.shouldReportPartialResults = false
  let done = DispatchSemaphore(value: 0)
  var text = ""
  rec.recognitionTask(with: req) { result, error in
    if let r = result, r.isFinal { text = r.bestTranscription.formattedString; done.signal() }
    else if let e = error { text = "FEHLER: \(e.localizedDescription)"; done.signal() }
  }
  while done.wait(timeout: .now() + 0.05) == .timedOut { RunLoop.current.run(until: Date() + 0.05) }
  print("\((f as NSString).lastPathComponent)\t\(text)")
}
