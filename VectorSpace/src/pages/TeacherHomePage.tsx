import { Link } from 'react-router'
import { ProjectListsSection } from '../sections/home/ProjectListsSection'

function GreetingTime(): string {
  const time_hour = new Date().getHours();
  
  if(time_hour>=8 && time_hour <12) return "Good morning";
  if(time_hour>=12 && time_hour <17) return "Good afternoon";
  if(time_hour>=17 && time_hour <21) return "Good evening";
  return "Good night"; 
}

type GreetingLoginName = {name?: string};

function GreetingMessage({name}:GreetingLoginName){
  const greeting = GreetingTime();
  return(<h1> {greeting} {name?`, ${name}`:""}!</h1>);
}



export default function TeacherHomePage() {
  return(
  <main>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">V</span><div><strong>VectorSpace</strong><span>Spatial Experience Builder</span></div></div>
        <div className="top-actions">
          {/*temp for login */}
        </div>
    </header>
    <div className="workspace">
      {/** add details from login here for name to be updated*/} 
      <GreetingMessage />
    <section className="center-stage">
      Preview of any build here
      <Link className="button primary" to="/teacher/template">Create/edit template</Link>
    </section>
    <ProjectListsSection />
    </div>
  </main>
)
}

