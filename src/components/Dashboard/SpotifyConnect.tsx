// import React from "react";
// import { useSpotifyLogin } from "../../hooks";
// import styles from "./Dashboard.module.scss";

// export default function SpotifyConnect() {
// 	const { mutate: login, isLoading } = useSpotifyLogin();

// 	const isConnected = typeof window !== "undefined" && !!localStorage.getItem("spotifyAccessToken");

// 	if (isConnected) {
// 		return (
// 			<button disabled className={styles.connectedButton}>
// 				Spotify Connected
// 			</button>
// 		);
// 	}

// 	return (
// 		<button onClick={() => login()} disabled={isLoading} className={styles.spotifyButton}>
// 			{isLoading ? "Connecting…" : "Connect Spotify"}
// 		</button>
// 	);
// }

export default function SpotifyConnect() {
	return null;
}
