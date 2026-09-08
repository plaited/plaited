/**
 * Initial system threads — the mutable surface for figuring out the kernel's
 * bootstrap behavioral programs.
 *
 * @remarks
 * Intentionally empty in this task. This is the LAST piece of the kernel
 * adapter collapse: the home for the system threads that react to kernel
 * events (e.g. `plugin.loaded` from the plugin-loader tool) and drive
 * provisioning — discovery-row population, thread registration, model
 * routing. Do not populate until the initial threads are designed.
 *
 * @packageDocumentation
 */
