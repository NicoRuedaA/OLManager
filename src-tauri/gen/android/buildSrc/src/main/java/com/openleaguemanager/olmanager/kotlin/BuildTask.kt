import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val projectDir = project.projectDir
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        // Map Rust target to jniLibs ABI
        val abiDir = when (target) {
            "aarch64" -> "arm64-v8a"
            "armv7" -> "armeabi-v7a"
            "i686" -> "x86"
            "x86_64" -> "x86_64"
            else -> throw GradleException("Unknown target: $target")
        }

        val srcDir = projectDir.parentFile.parentFile.parentFile
        // Prefer release profile (built by `npx tauri android build`), fallback to debug
        val buildProfiles = if (release) listOf("release") else listOf("release", "debug")

        for (profile in buildProfiles) {
            val rustLib = File(srcDir, "target/$target-linux-android/$profile/libolmanager_lib.so")
            if (rustLib.exists()) {
                val jniLib = File(projectDir, "src/main/jniLibs/$abiDir/libolmanager_lib.so")
                jniLib.parentFile.mkdirs()
                rustLib.copyTo(jniLib, overwrite = true)
                project.logger.lifecycle("Copied $rustLib -> $jniLib")
                return
            }
        }

        project.logger.warn("Prebuilt .so not found for $target, falling back to Tauri CLI")
        runTauriCli()
    }

    fun runTauriCli() {
        val executable = """npm""";
        try {
            runTauriCliWithExe(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                val fallbacks = listOf("$executable.exe", "$executable.cmd", "$executable.bat")
                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCliWithExe(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e
            }
        }
    }

    fun runTauriCliWithExe(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        project.exec {
            workingDir(File(project.projectDir, rootDirRel))
            executable(executable)
            args(listOf("run", "--", "tauri", "android", "android-studio-script"))
            if (project.logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (project.logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release == true) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }
}