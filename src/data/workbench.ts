// Project photos for the homepage "From the workbench" gallery.
// To add one: put the image in src/assets/images/workbench/ (strip location data first),
// import it here and add an entry. The first photo gets the large tile.
import type { ImageMetadata } from 'astro';
import robotArm from '../assets/images/workbench/robot-arm-ultrasonic.jpg';
import kinectRobot from '../assets/images/workbench/kinect-mapping-robot.jpg';
import oscilloscope from '../assets/images/workbench/oscilloscope-echoes.jpg';
import launchpad from '../assets/images/workbench/launchpad-motor-control.jpg';
import surfacePlot from '../assets/images/workbench/matlab-surface-plot.png';

export interface WorkbenchPhoto {
	image: ImageMetadata;
	alt: string; // what the photo shows, for screen readers
	title: string;
	caption: string;
	/** 'contain' keeps the whole image visible (charts, screenshots); default crops to fill the tile. */
	fit?: 'cover' | 'contain';
}

export const workbenchPhotos: WorkbenchPhoto[] = [
	{
		image: robotArm,
		alt: 'A Doosan collaborative robot arm holding a probe over a water tank on a lab bench, next to an oscilloscope',
		title: 'Robotic ultrasonic scanning',
		caption: 'A collaborative robot arm sweeping a probe over a water-immersion test bench.',
	},
	{
		image: kinectRobot,
		alt: 'A homemade wooden mobile robot carrying a laptop, an Xbox Kinect sensor and a phone',
		title: 'A homemade mapping robot',
		caption: 'A DIY mobile robot that maps its surroundings with a Kinect depth sensor.',
	},
	{
		image: oscilloscope,
		alt: 'Oscilloscope screen showing two bursts of echo signals',
		title: 'Reading the echoes',
		caption: 'Echo signals from the scanning setup, captured on the oscilloscope.',
	},
	{
		image: launchpad,
		alt: 'A Texas Instruments LaunchPad wired to a trainer board with an LCD and keypad, driving a DC motor through an L298N motor driver',
		title: 'Motor control on a LaunchPad',
		caption: 'A TI LaunchPad driving a DC motor through an L298N driver board.',
	},
	{
		image: surfacePlot,
		alt: 'A 3D surface plot in MATLAB with a valley-shaped surface coloured from blue to yellow',
		title: 'Making sense of the data',
		caption: 'A 3D surface plot from a MATLAB analysis.',
		fit: 'contain',
	},
];
