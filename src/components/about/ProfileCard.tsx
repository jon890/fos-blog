import Image from "next/image";

interface ProfileCardProps {
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
}

export function ProfileCard({
  name,
  handle,
  bio,
  avatarUrl,
  htmlUrl,
  publicRepos,
  followers,
}: ProfileCardProps) {
  return (
    <article className="ab-card ab-profile">
      <div className="ab-avatar">
        <span className="ab-avatar-initial">{name.charAt(0).toUpperCase()}</span>
        {avatarUrl && (
          <Image
            src={avatarUrl}
            alt={name}
            fill
            sizes="128px"
            className="ab-avatar-img"
          />
        )}
      </div>
      <div className="ab-profile-body">
        <h2 className="ab-profile-name">
          {name}
          <span className="handle">{handle}</span>
        </h2>
        <p className="ab-profile-bio">{bio}</p>
        <div className="ab-profile-stats">
          <span className="stat">
            <span className="num">{publicRepos}</span>
            <span className="lbl">repos</span>
          </span>
          <span className="stat">
            <span className="num">{followers}</span>
            <span className="lbl">followers</span>
          </span>
        </div>
        <a
          className="ab-profile-cta"
          href={htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{htmlUrl.replace(/^https?:\/\//, "")}</span>
          <span className="arr">↗</span>
        </a>
      </div>
    </article>
  );
}
